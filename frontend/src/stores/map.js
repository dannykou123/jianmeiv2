import { defineStore } from 'pinia'
import { addressLatLng, storeLocation } from '../data/mapPoints.js'

export const useMapStore = defineStore('map', {
  state: () => ({
    origin: { ...storeLocation },
    addressLatLng: { ...addressLatLng }
  }),
  actions: {
    setOrigin(origin) {
      this.origin = { ...this.origin, ...origin }
    },
    resetOrigin() {
      this.origin = { ...storeLocation }
    },
    resetMap() {
      this.origin = { ...storeLocation }
      this.addressLatLng = { ...addressLatLng }
    }
  }
})
