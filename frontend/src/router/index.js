import { createRouter, createWebHashHistory } from 'vue-router'
import EntryView from '../views/EntryView.vue'
import AdminShell from '../views/AdminShell.vue'
import OrdererView from '../views/OrdererView.vue'
import OrganizerView from '../views/OrganizerView.vue'

const routes = [
  { path: '/', name: 'entry', component: EntryView },
  { path: '/admin/:view?', name: 'admin', component: AdminShell, props: true },
  { path: '/orderer', name: 'orderer', component: OrdererView },
  { path: '/organizer/:teamId?', name: 'organizer', component: OrganizerView, props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})
