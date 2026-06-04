#!/usr/bin/env python3
"""
健美滷味 NAS 列印微服務 v3.1 – Pillow BITMAP 模式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
中文字透過 Noto CJK 字型在 Python 側 rasterize → TSPL BITMAP → 印表機
字型大小與間距完全對齊 index.html CSS：
  .label-company   14pt bold   line-height 1.25
  .label-delivery  10pt        margin-top 0.5mm
  .label-customer  14pt bold   margin-bottom 2mm (from border)
  .label-item-name 10pt bold   line-height 1.2   padding 0.8mm
  .label-item-right 9.5pt      line-height 1.2
  compact mode     9.5pt/9pt                     padding 0.3mm
  .label-total     15pt bold   right-aligned
  .label-note      9pt         margin-top 0.3mm
  footer           8pt         border-top 2px    margin-top 1.2mm
"""

import os
import io
import re
import base64
import binascii
import uuid
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import List, Optional, Union
from PIL import Image, ImageDraw, ImageFont

# ======================================================================
#  硬體常數
# ======================================================================
PRINTER_USB_DEV = os.getenv("PRINTER_USB_DEV", "/dev/usb/lp0")
PRINTS_DIR = Path(os.getenv("PRINTS_DIR", "prints"))
MAX_PRINT_UPLOAD_BYTES = int(os.getenv("MAX_PRINT_UPLOAD_BYTES", str(5 * 1024 * 1024)))
ITEMS_PER_PAGE  = 10

DPI = 203
W   = round(70  * DPI / 25.4)   # 559 dots
H   = round(100 * DPI / 25.4)   # 813 dots

PNG_DATA_URL_RE = re.compile(r"^data:image/png;base64,([A-Za-z0-9+/=]+)$", re.IGNORECASE)
SUPPORTED_IMAGE_KINDS = {"ship", "prep", "order"}


def mm(m: float) -> int:
    """mm → dots @203 DPI"""
    return round(m * DPI / 25.4)


def pt(p: float) -> int:
    """pt → dots @203 DPI"""
    return round(p * DPI / 72)


def lh(size: int, factor: float = 1.0) -> int:
    """line-height block height"""
    return round(size * factor)


# ── Outer padding: HTML padding: 3mm ─────────────────────────────────
PAD     = mm(3)         # 24

# ── Items column layout: HTML column-gap: 3mm, grid 1fr 1fr ──────────
COL_GAP = mm(3)         # 24
COL_W   = (W - 2 * PAD - COL_GAP) // 2   # 264

# ======================================================================
#  字型大小 (pt → dots)
# ======================================================================
FS_COMPANY     = pt(14)    # 40  bold
FS_DELIVERY    = pt(10)    # 28
FS_CUSTOMER    = pt(14)    # 40  bold
FS_UNIT        = pt(11)    # 31  normal  (部門)
FS_ITEM_NAME   = pt(10)    # 28  bold
FS_ITEM_QTY    = pt(9.5)   # 27
FS_TOTAL       = pt(15)    # 42  bold
FS_NOTE        = pt(9)     # 25
FS_FOOTER      = pt(8)     # 23
FS_ITEM_NAME_C = pt(9.5)   # 27  bold  (compact)
FS_ITEM_QTY_C  = pt(9)     # 25        (compact)

# ======================================================================
#  Y 座標（從上到下，對齊 HTML layout）
# ======================================================================
# HTML: padding-top 3mm
Y_COMPANY     = PAD                                             # 24

# HTML: company line-height 1.25 + delivery margin-top 0.5mm
Y_DELIVERY    = Y_COMPANY + lh(FS_COMPANY, 1.25) + mm(0.5)
#               24 + 50 + 4 = 78

# HTML: header padding-bottom 2mm → 分隔線
Y_HEADER_LINE = Y_DELIVERY + FS_DELIVERY + mm(2)
#               78 + 28 + 16 = 122

# HTML: header border 2px + margin-bottom 2mm
Y_CUSTOMER    = Y_HEADER_LINE + 2 + mm(2)
#               122 + 2 + 16 = 140

# HTML: customer row height + margin-bottom 2mm
Y_ITEMS_START = Y_CUSTOMER + lh(FS_CUSTOMER) + mm(2)
#               140 + 40 + 16 = 196

# ── Footer（從下錨定，對應 HTML margin-top:auto）──────────────────────
Y_BOTTOM    = H - PAD                                          # 789

# HTML footer 8pt text row
Y_ORDER     = Y_BOTTOM - FS_FOOTER                            # 766

# HTML border-top 2px, margin-bottom 0.3mm above border
Y_DIV_LINE  = Y_ORDER - 2 - mm(0.3)                           # 762

# HTML border 2px + margin-top 1.2mm above border
Y_ABOVE_FTR = Y_DIV_LINE - 2 - mm(1.2)                        # 750

# 合計 (15pt bold, right-aligned)
Y_TOTAL     = Y_ABOVE_FTR - lh(FS_TOTAL)                      # 708

# 備註 (9pt, margin-top 0.3mm above total)
Y_NOTE      = Y_TOTAL - mm(0.3) - lh(FS_NOTE)                 # 681

# ======================================================================
#  品項列高
# ======================================================================
# Normal: padding 0.8mm/row, name lh1.2, qty lh1.2
ITEM_ROW_H   = (mm(0.8)
                + lh(FS_ITEM_NAME, 1.2)
                + lh(FS_ITEM_QTY,  1.2)
                + mm(0.8))
# = 6 + 34 + 32 + 6 = 78

# Compact: padding 0.3mm, smaller fonts
ITEM_ROW_H_C = (mm(0.3)
                + lh(FS_ITEM_NAME_C, 1.2)
                + lh(FS_ITEM_QTY_C,  1.2)
                + mm(0.3))
# = 2 + 32 + 30 + 2 = 66

# ======================================================================
#  字型路徑
# ======================================================================
_BOLD_FONTS = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKtc-Bold.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKtc-Bold.ttf",
]
_REG_FONTS = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKtc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.ttf",
]


def _load(candidates: list, size: int) -> ImageFont.FreeTypeFont:
    for p in candidates:
        if os.path.exists(p):
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


def _fonts() -> dict:
    return {
        # bold
        "company":    _load(_BOLD_FONTS, FS_COMPANY),
        "customer":   _load(_BOLD_FONTS, FS_CUSTOMER),
        "unit":       _load(_REG_FONTS,  FS_UNIT),
        "item_name":  _load(_BOLD_FONTS, FS_ITEM_NAME),
        "item_name_c":_load(_BOLD_FONTS, FS_ITEM_NAME_C),
        "total":      _load(_BOLD_FONTS, FS_TOTAL),
        # regular
        "delivery":   _load(_REG_FONTS,  FS_DELIVERY),
        "item_qty":   _load(_REG_FONTS,  FS_ITEM_QTY),
        "item_qty_c": _load(_REG_FONTS,  FS_ITEM_QTY_C),
        "note":       _load(_REG_FONTS,  FS_NOTE),
        "footer":     _load(_REG_FONTS,  FS_FOOTER),
    }


# ======================================================================
#  Pydantic 資料模型
# ======================================================================
class Item(BaseModel):
    name:  str
    qty:   int
    price: int


class PrintRequest(BaseModel):
    orderNo:    str
    date:       str
    company:    str
    department: Optional[str] = ""
    name:       str
    items:      List[Item]
    remark:     Optional[str] = ""
    total:      int
    orderType:  Optional[str] = "regular"


# ── 備貨單資料模型 ─────────────────────────────────────────────────────
class StockItem(BaseModel):
    name: str
    qty:  Union[int, str]


class StockPrintRequest(BaseModel):
    orderNo: str
    date:    str
    company: str
    items:   List[StockItem]
    orderType: Optional[str] = "regular"


class NasImagePrintRequest(BaseModel):
    kind: str
    queue: str
    widthMm: float
    heightMm: float
    format: str
    images: List[str]
    ts: int


# ======================================================================
#  備貨單字型大小（對齊 CSS .stock-ticket-* 規格）
# ======================================================================
# .stock-ticket-title  15pt bold
# .stock-ticket-meta   10pt regular  margin-top 0.3mm
# .stock-ticket-name   11pt bold     line-height 1.2
# .stock-ticket-qty    11pt bold     line-height 1.2  padding 0.4mm
# .stock-ticket-footer 10pt regular  margin-top auto  border-top 1px
FS_STITLE   = pt(15)    # 42  bold
FS_SMETA    = pt(10)    # 28  regular
FS_SNAME    = pt(11)    # 31  bold
FS_SQTY     = pt(11)    # 31  bold
FS_SFOOTER  = pt(10)    # 28  regular

# ── 備貨單 Y 座標 ─────────────────────────────────────────────────────
# CSS: padding 3mm (same PAD=24)
Y_STITLE       = PAD                                              # 24
Y_SMETA        = Y_STITLE + lh(FS_STITLE, 1.0) + mm(2)           # 24+42+15 = 81
Y_SHEADER_LINE = Y_SMETA  + FS_SMETA + mm(1.0)                    # 81+28+8 = 117
Y_SITEMS       = Y_SHEADER_LINE + 2 + mm(1.2)                     # 117+2+10 = 129

# Footer 從下錨定
Y_SFOOTER      = H - PAD - FS_SFOOTER                             # 813-24-28 = 761
Y_SF_LINE      = Y_SFOOTER - mm(1) - 2                            # 761-8-2 = 751

# ── 備貨單品項行高 ────────────────────────────────────────────────────
SROW_PAD   = mm(0.4)                                               # 3
SROW_H     = SROW_PAD + lh(FS_SNAME, 1.2) + lh(FS_SQTY, 1.2) + SROW_PAD
# 3 + round(31*1.2)=37 + 37 + 3 = 80

STOCK_ITEMS_PER_PAGE = 12   # 2 欄 × 6 列


# ======================================================================
#  Pillow 繪圖：中文字透過 Noto CJK 字型 rasterize 到 bitmap
# ======================================================================
def _tw(draw: ImageDraw.ImageDraw, text: str, font) -> int:
    bb = draw.textbbox((0, 0), text, font=font)
    return bb[2] - bb[0]


def draw_label(req: PrintRequest, page_items: List[Item],
               page_num: int, total_pages: int, is_last: bool,
               fnt: dict) -> Image.Image:
    """Pillow 繪製單張標籤，白底黑字 L mode Image"""
    img  = Image.new("L", (W, H), 255)
    draw = ImageDraw.Draw(img)
    BK   = 0

    # ── 公司名 (14pt bold, line-height 1.25) ─────────────────────────
    draw.text((PAD, Y_COMPANY), req.company, font=fnt["company"], fill=BK)

    # ── 真空包裝標記 ([真空]) ──────────────────────────────────────────
    if getattr(req, 'orderType', 'regular') == 'vacuum':
        vac_label = '[真空]'
        x_vac = PAD + _tw(draw, req.company, fnt["company"]) + mm(1.5)
        draw.text((x_vac, Y_COMPANY), vac_label, font=fnt["delivery"], fill=BK)

    # ── 配送日期 (10pt, margin-top 0.5mm) ────────────────────────────
    try:
        if 'T' in req.date:
            date_part, time_part = req.date.split('T')
            ds = datetime.strptime(date_part, "%Y-%m-%d").strftime("%Y/%m/%d")
            delivery_line = f"配送：{ds} {time_part}"
        else:
            ds = datetime.strptime(req.date, "%Y-%m-%d").strftime("%Y/%m/%d")
            delivery_line = f"配送：{ds}"
    except Exception:
        delivery_line = f"配送：{req.date}"
    draw.text((PAD, Y_DELIVERY), delivery_line, font=fnt["delivery"], fill=BK)

    # ── Header 分隔線 (border-bottom 2px) ────────────────────────────
    draw.line([(PAD, Y_HEADER_LINE), (W - PAD, Y_HEADER_LINE)],
              fill=BK, width=2)

    # ── 客戶名 (14pt bold) ＋ 部門 (11pt) ────────────────────────────
    draw.text((PAD, Y_CUSTOMER), req.name, font=fnt["customer"], fill=BK)
    if req.department:
        x_unit = PAD + _tw(draw, req.name, fnt["customer"]) + mm(1.5)
        y_unit = Y_CUSTOMER + mm(0.5)   # 輕微下移對齊 baseline
        draw.text((x_unit, y_unit), req.department, font=fnt["unit"], fill=BK)

    # 頁碼（右上角 8pt，多頁才顯示）
    pi = f"{page_num}/{total_pages}"
    if total_pages > 1:
        draw.text((W - PAD - _tw(draw, pi, fnt["footer"]),
                   Y_CUSTOMER + mm(1)),
                  pi, font=fnt["footer"], fill=BK)

    # ── 品項 grid（2 欄，column-gap 3mm）─────────────────────────────
    compact  = is_last and bool(req.remark) and len(page_items) >= ITEMS_PER_PAGE
    fn       = fnt["item_name_c"] if compact else fnt["item_name"]
    fq       = fnt["item_qty_c"]  if compact else fnt["item_qty"]
    rh       = ITEM_ROW_H_C       if compact else ITEM_ROW_H
    pad_row  = mm(0.3)            if compact else mm(0.8)
    fs_n     = FS_ITEM_NAME_C     if compact else FS_ITEM_NAME
    fs_q     = FS_ITEM_QTY_C      if compact else FS_ITEM_QTY

    for i, item in enumerate(page_items):
        col  = i % 2
        row  = i // 2
        x    = PAD + col * (COL_W + COL_GAP)
        y    = Y_ITEMS_START + row * rh

        y_name = y + pad_row
        y_qty  = y_name + lh(fs_n, 1.2)

        draw.text((x, y_name), item.name, font=fn, fill=BK)
        qty_str = f"×{item.qty}　${item.qty * item.price:,}"
        draw.text((x, y_qty),  qty_str,   font=fq, fill=BK)

    # ── 最後一頁：備註 + 合計 ─────────────────────────────────────────
    if is_last and req.remark:
        draw.text((PAD, Y_NOTE), f"備註：{req.remark}",
                  font=fnt["note"], fill=BK)

    if is_last:
        total_str = f"合計 ${req.total:,}"
        draw.text((W - PAD - _tw(draw, total_str, fnt["total"]), Y_TOTAL),
                  total_str, font=fnt["total"], fill=BK)

    # ── Footer 分隔線 (border-top 2px) ───────────────────────────────
    draw.line([(PAD, Y_DIV_LINE), (W - PAD, Y_DIV_LINE)], fill=BK, width=2)

    # ── 訂單編號（左）＋ 頁碼（右）─────────────────────────────────
    draw.text((PAD, Y_ORDER), f"訂單編號：{req.orderNo}",
              font=fnt["footer"], fill=BK)
    draw.text((W - PAD - _tw(draw, pi, fnt["footer"]), Y_ORDER),
              pi, font=fnt["footer"], fill=BK)

    return img


# ======================================================================
#  Image → TSPL BITMAP bytes
# ======================================================================
def image_to_tspl(img: Image.Image) -> bytes:
    """
    PIL Image (白底黑字) → TSPL BITMAP 指令 bytes

    BITMAP x,y,width_bytes,height,mode,<raw_data>
    mode=0: bit 0=黑點(印)  bit 1=白(不印)
    PIL '1' tobytes: pixel 0(黑)->bit 0, pixel 255(白)->bit 1  ✓ 直接符合，無需反轉
    """
    if img.size != (W, H):
        img = img.resize((W, H), Image.LANCZOS)

    raw  = img.convert("1").tobytes()
    wb   = (W + 7) // 8    # 559 bits / 8 = 70 bytes per row

    header = (
        "SIZE 70 mm, 100 mm\r\n"
        "GAP 3 mm, 0 mm\r\n"
        "DIRECTION 0\r\n"
        "REFERENCE 0,0\r\n"
        "CLS\r\n"
    ).encode("ascii")
    bitmap = f"BITMAP 0,0,{wb},{H},0,".encode("ascii")
    footer = b"\r\nPRINT 1,1\r\n"

    return header + bitmap + raw + footer


def _api_error(error: str, message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"ok": False, "error": error, "message": message},
        headers={"Access-Control-Allow-Origin": "*"},
    )


def _make_job_id(now: Optional[datetime] = None) -> str:
    now = now or datetime.now()
    return f"jm_{now.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"


def _prepare_image_for_print(img: Image.Image) -> Image.Image:
    if img.mode in ("RGBA", "LA") or "transparency" in img.info:
        rgba = img.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        bg.alpha_composite(rgba)
        return bg.convert("L")
    return img.convert("L")


def _decode_png_data_url(data_url: str, index: int) -> Image.Image:
    match = PNG_DATA_URL_RE.match(data_url.strip())
    if not match:
        raise ValueError(f"images[{index}] is not a valid PNG data URL")

    try:
        raw = base64.b64decode(match.group(1), validate=True)
    except (binascii.Error, ValueError):
        raise ValueError(f"images[{index}] is not a valid PNG data URL")

    if not raw.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError(f"images[{index}] is not a valid PNG data URL")

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img.load()
            return _prepare_image_for_print(img)
    except Exception:
        raise ValueError(f"images[{index}] is not a valid PNG data URL")


def _save_print_images(job_id: str, images: List[Image.Image], now: datetime) -> None:
    day_dir = PRINTS_DIR / now.strftime("%Y%m%d")
    day_dir.mkdir(parents=True, exist_ok=True)
    for page, img in enumerate(images, start=1):
        img.save(day_dir / f"{job_id}_{page}.png", format="PNG")


def build_image_tspl(images: List[Image.Image]) -> bytes:
    return b"".join(image_to_tspl(img) for img in images)


# ======================================================================
#  整張訂單分頁
# ======================================================================
def _pages(req: PrintRequest) -> List[List[Item]]:
    items = req.items
    if not items:
        return [[]]
    return [items[i: i + ITEMS_PER_PAGE]
            for i in range(0, len(items), ITEMS_PER_PAGE)]


def build_tspl(req: PrintRequest) -> bytes:
    """所有頁合併成完整 TSPL bytes"""
    fnt   = _fonts()
    pages = _pages(req)
    out   = b""
    for idx, chunk in enumerate(pages):
        img  = draw_label(req, chunk, idx+1, len(pages), idx == len(pages)-1, fnt)
        out += image_to_tspl(img)
    return out


def build_previews(req: PrintRequest) -> List[Image.Image]:
    fnt   = _fonts()
    pages = _pages(req)
    return [draw_label(req, chunk, idx + 1, len(pages), idx == len(pages) - 1, fnt)
            for idx, chunk in enumerate(pages)]


# ======================================================================
#  備貨單字型載入
# ======================================================================
def _stock_fonts() -> dict:
    return {
        "title":  _load(_BOLD_FONTS, FS_STITLE),
        "meta":   _load(_REG_FONTS,  FS_SMETA),
        "name":   _load(_BOLD_FONTS, FS_SNAME),
        "qty":    _load(_BOLD_FONTS, FS_SQTY),
        "footer": _load(_REG_FONTS,  FS_SFOOTER),
    }


# ======================================================================
#  備貨單 Pillow 繪圖
# ======================================================================
def draw_stock_label(req: StockPrintRequest, page_items: List[StockItem],
                     page_num: int, total_pages: int,
                     fnt: dict) -> Image.Image:
    """
    繪製單張備貨單 75×100mm。
    對齊 CSS：
      .stock-ticket-title  15pt bold
      .stock-ticket-meta   10pt  color #444
      .stock-ticket-name   11pt bold  line-height 1.2
      .stock-ticket-qty    11pt bold  line-height 1.2  padding 0.4mm
      .stock-ticket-footer 10pt  border-top 1px  padding-top 1mm  margin-top auto
    """
    img  = Image.new("L", (W, H), 255)
    draw = ImageDraw.Draw(img)
    BK   = 0
    GRAY = 160   # #ddd border on item rows

    # ── 標題 (15pt bold) ─────────────────────────────────────────────
    draw.text((PAD, Y_STITLE), "健美滷味 備料清單",
              font=fnt["title"], fill=BK)

    # ── Meta：公司名 + 配送日期 + 真空標記 (10pt, color #444 → gray 80) ───────────
    try:
        ds = datetime.strptime(req.date, "%Y-%m-%d").strftime("%m/%d")
    except Exception:
        ds = req.date
    type_tag = "【真空】" if getattr(req, 'orderType', 'regular') == 'vacuum' else ""
    meta_txt = f"{req.company}{type_tag}　{ds}"
    draw.text((PAD, Y_SMETA), meta_txt, font=fnt["meta"], fill=80)

    # ── Header 分隔線 (border-bottom 1.5px) ──────────────────────────
    draw.line([(PAD, Y_SHEADER_LINE), (W - PAD, Y_SHEADER_LINE)],
              fill=BK, width=2)

    # ── 品項 grid (2 欄，column-gap 3mm) ─────────────────────────────
    for i, item in enumerate(page_items):
        col = i % 2
        row = i // 2
        x   = PAD + col * (COL_W + COL_GAP)
        y   = Y_SITEMS + row * SROW_H

        y_name = y + SROW_PAD
        y_qty  = y_name + lh(FS_SNAME, 1.2)

        draw.text((x, y_name), item.name, font=fnt["name"], fill=BK)
        qty_str = item.qty if isinstance(item.qty, str) else f"×{item.qty}"
        draw.text((x, y_qty),  qty_str, font=fnt["qty"], fill=BK)

        # 每行底部虛分隔（border-bottom 0.5px #ddd）
        y_sep = y + SROW_H - 1
        draw.line([(x, y_sep), (x + COL_W - mm(1), y_sep)],
                  fill=GRAY, width=1)

    # ── Footer 分隔線 (border-top 1px) ───────────────────────────────
    draw.line([(PAD, Y_SF_LINE), (W - PAD, Y_SF_LINE)],
              fill=BK, width=1)

    # ── Footer 文字：左"健美滷味"，右"頁/總頁" ───────────────────────
    page_str = f"{page_num}/{total_pages}"
    draw.text((PAD, Y_SFOOTER), "健美滷味",
              font=fnt["footer"], fill=100)
    draw.text((W - PAD - _tw(draw, page_str, fnt["footer"]), Y_SFOOTER),
              page_str, font=fnt["footer"], fill=100)

    return img


# ======================================================================
#  備貨單分頁 / 建立 TSPL / 建立預覽
# ======================================================================
def _pages_stock(req: StockPrintRequest) -> List[List[StockItem]]:
    items = req.items
    if not items:
        return [[]]
    return [items[i: i + STOCK_ITEMS_PER_PAGE]
            for i in range(0, len(items), STOCK_ITEMS_PER_PAGE)]


def build_stock_tspl(req: StockPrintRequest) -> bytes:
    fnt   = _stock_fonts()
    pages = _pages_stock(req)
    out   = b""
    for idx, chunk in enumerate(pages):
        img  = draw_stock_label(req, chunk, idx + 1, len(pages), fnt)
        out += image_to_tspl(img)
    return out


def build_stock_previews(req: StockPrintRequest) -> List[Image.Image]:
    fnt   = _stock_fonts()
    pages = _pages_stock(req)
    return [draw_stock_label(req, chunk, idx + 1, len(pages), fnt)
            for idx, chunk in enumerate(pages)]


# ======================================================================
#  USB 寫入
# ======================================================================
def send_to_printer(data: bytes) -> None:
    try:
        with open(PRINTER_USB_DEV, "wb") as dev:
            dev.write(data)
    except FileNotFoundError:
        raise FileNotFoundError(f"找不到 USB 裝置 {PRINTER_USB_DEV}")
    except PermissionError:
        raise PermissionError(f"無權限存取 {PRINTER_USB_DEV}")


# ======================================================================
#  FastAPI App
# ======================================================================
app = FastAPI(title="健美滷味 NAS 列印 v3.1", version="3.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_print_payload_limit(request: Request, call_next):
    if request.url.path == "/print":
        body = await request.body()
        if len(body) > MAX_PRINT_UPLOAD_BYTES:
            return _api_error(
                "PAYLOAD_TOO_LARGE",
                f"request body exceeds {MAX_PRINT_UPLOAD_BYTES} bytes",
                413,
            )

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        request = Request(request.scope, receive)

    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    if request.url.path == "/print":
        return _api_error(
            "INVALID_REQUEST",
            "request body must include kind, queue, widthMm, heightMm, format, images, and ts",
            422,
        )
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/ping")
def ping():
    return {"ok": True, "service": "jianmei-nas-print"}


@app.post("/print")
def print_uploaded_images(req: NasImagePrintRequest):
    kind = req.kind.strip().lower()
    queue = req.queue.strip()
    if kind not in SUPPORTED_IMAGE_KINDS:
        return _api_error(
            "INVALID_KIND",
            "kind must be one of: ship, prep, order",
        )
    if not queue:
        return _api_error("INVALID_QUEUE", "queue is required")
    if req.widthMm <= 0 or req.heightMm <= 0:
        return _api_error("INVALID_SIZE", "widthMm and heightMm must be positive")
    if req.format.lower() != "image":
        return _api_error("INVALID_FORMAT", "format must be image")
    if not req.images:
        return _api_error("INVALID_IMAGE", "images must contain at least one PNG data URL")

    try:
        images = [_decode_png_data_url(data_url, idx) for idx, data_url in enumerate(req.images)]
    except ValueError as e:
        return _api_error("INVALID_IMAGE", str(e))

    now = datetime.now()
    job_id = _make_job_id(now)

    try:
        _save_print_images(job_id, images, now)
    except OSError as e:
        return _api_error("STORAGE_ERROR", str(e), 500)

    try:
        send_to_printer(build_image_tspl(images))
    except FileNotFoundError as e:
        return _api_error("PRINTER_NOT_FOUND", str(e), 503)
    except PermissionError as e:
        return _api_error("PRINTER_PERMISSION_DENIED", str(e), 503)
    except Exception as e:
        return _api_error("PRINT_FAILED", str(e), 500)

    return {
        "ok": True,
        "jobId": job_id,
        "received": len(images),
        "queue": queue,
    }


@app.post("/api/print-label")
def print_label(req: PrintRequest):
    """JSON → Pillow 繪圖 → TSPL BITMAP → USB"""
    try:
        send_to_printer(build_tspl(req))
        return {
            "ok":      True,
            "message": f"已列印：{req.name}（{req.orderNo}），共 {len(_pages(req))} 張",
        }
    except FileNotFoundError as e:
        raise HTTPException(503, detail=str(e))
    except PermissionError as e:
        raise HTTPException(503, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/api/preview-image")
def preview_image(req: PrintRequest, page: int = 1):
    """預覽指定頁標籤的 PNG 圖片（page 從 1 起算）
    回應 header：
      X-Total-Pages  總頁數
      X-Current-Page 本頁頁碼
    """
    try:
        imgs  = build_previews(req)
        total = len(imgs)
        page  = max(1, min(page, total))   # 夾入合法範圍
        buf   = io.BytesIO()
        imgs[page - 1].save(buf, format="PNG")
        return Response(
            content=buf.getvalue(),
            media_type="image/png",
            headers={
                "X-Total-Pages":  str(total),
                "X-Current-Page": str(page),
                "Access-Control-Expose-Headers": "X-Total-Pages, X-Current-Page",
            },
        )
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/api/preview-all")
def preview_all(req: PrintRequest):
    """所有頁合併成一張長圖（PNG）"""
    try:
        imgs   = build_previews(req)
        canvas = Image.new("L", (W, sum(i.height for i in imgs)), 255)
        y = 0
        for im in imgs:
            canvas.paste(im, (0, y)); y += im.height
        buf = io.BytesIO()
        canvas.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ======================================================================
#  備貨單 API
# ======================================================================
@app.post("/api/print-stock")
def print_stock(req: StockPrintRequest):
    """備貨單 JSON → Pillow 繪圖 → TSPL BITMAP → USB"""
    try:
        send_to_printer(build_stock_tspl(req))
        pages = len(_pages_stock(req))
        return {
            "ok":      True,
            "message": f"備貨單已列印：{req.company}（{req.orderNo}），共 {pages} 張",
        }
    except FileNotFoundError as e:
        raise HTTPException(503, detail=str(e))
    except PermissionError as e:
        raise HTTPException(503, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/api/preview-stock")
def preview_stock(req: StockPrintRequest, page: int = 1):
    """預覽備貨單指定頁 PNG（page 從 1 起算）
    回應 header：
      X-Total-Pages  總頁數
      X-Current-Page 本頁頁碼
    """
    try:
        imgs  = build_stock_previews(req)
        total = len(imgs)
        page  = max(1, min(page, total))
        buf   = io.BytesIO()
        imgs[page - 1].save(buf, format="PNG")
        return Response(
            content=buf.getvalue(),
            media_type="image/png",
            headers={
                "X-Total-Pages":  str(total),
                "X-Current-Page": str(page),
                "Access-Control-Expose-Headers": "X-Total-Pages, X-Current-Page",
            },
        )
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/api/preview-stock-all")
def preview_stock_all(req: StockPrintRequest):
    """備貨單所有頁合併成一張長圖（PNG）"""
    try:
        imgs   = build_stock_previews(req)
        canvas = Image.new("L", (W, sum(i.height for i in imgs)), 255)
        y = 0
        for im in imgs:
            canvas.paste(im, (0, y)); y += im.height
        buf = io.BytesIO()
        canvas.save(buf, format="PNG")
        return Response(content=buf.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get("/health")
def health():
    usb_ok    = os.path.exists(PRINTER_USB_DEV)
    bold_font = next((p for p in _BOLD_FONTS if os.path.exists(p)), "NOT FOUND")
    reg_font  = next((p for p in _REG_FONTS  if os.path.exists(p)), "NOT FOUND")
    return {
        "status":       "ok" if usb_ok else "printer_not_found",
        "device":       PRINTER_USB_DEV,
        "usb_ready":    usb_ok,
        "font_bold":    bold_font,
        "font_regular": reg_font,
        "canvas":       f"{W}×{H} @ {DPI} DPI",
        "mode":         "pillow-bitmap v3.1",
    }
