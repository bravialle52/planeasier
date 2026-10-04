import { create } from 'zustand'

export interface Account {
  id: string
  email: string
  displayName: string
}

interface AuthState {
  token: string | null
  user: Account | null
  projectId: string | null
  projectName: string
  setSession: (token: string, user: Account) => void
  hydrate: (user: Account) => void
  logout: () => void
  rememberProject: (projectId: string, name: string) => void
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem('planeasier_token'),
  user: null,
  projectId: localStorage.getItem('planeasier_project_id'),
  projectName: '',
  setSession: (token, user) => {
    localStorage.setItem('planeasier_token', token)
    set({ token, user })
  },
  hydrate: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem('planeasier_token')
    localStorage.removeItem('planeasier_project_id')
    set({ token: null, user: null, projectId: null, projectName: '' })
  },
  rememberProject: (projectId, name) => {
    localStorage.setItem('planeasier_project_id', projectId)
    set({ projectId, projectName: name })
  }
}))
