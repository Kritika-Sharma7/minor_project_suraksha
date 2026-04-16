import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: BASE,
  timeout: 15000,
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'API error'
    return Promise.reject(new Error(msg))
  }
)

export const analyzeRisk = (payload) =>
  api.post('/analyze-risk', payload).then((r) => r.data)

export const detectAudio = (file) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/audio-detect', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const triggerAlert = (payload) =>
  api.post('/trigger-alert', payload).then((r) => r.data)

export const getHistory = (limit = 50) =>
  api.get('/history', { params: { limit } }).then((r) => r.data)

export const resetEngine = () =>
  api.post('/reset').then((r) => r.data)

export const getAlertStatus = () =>
  api.get('/alert-status').then((r) => r.data)

export const getProfile = () =>
  api.get('/profile').then((r) => r.data)

export const updateProfile = (payload) =>
  api.put('/profile', payload).then((r) => r.data)

export const getContacts = () =>
  api.get('/contacts').then((r) => r.data)

export const addContact = (payload) =>
  api.post('/contacts', payload).then((r) => r.data)

export const getIncidents = (limit = 100) =>
  api.get('/incidents', { params: { limit } }).then((r) => r.data)

export const getThreatMap = (limit = 300) =>
  api.get('/threat-map', { params: { limit } }).then((r) => r.data)

export default api
