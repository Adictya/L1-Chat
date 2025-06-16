import { createFileRoute, redirect } from '@tanstack/react-router'
import { setTokens } from '../integrations/tanstack-store/auth-store'

export const Route = createFileRoute('/auth')({
  component: RouteComponent,
  beforeLoad: async () => {
    // Get the hash fragment from the URL
    const hash = window.location.hash.substring(1) // Remove the # character
    
    // Parse the hash fragment into an object
    const searchParams = new URLSearchParams(hash)
    
    // Extract the tokens
    const access_token = searchParams.get('access_token')
    const refresh_token = searchParams.get('refresh_token')
    
    if (access_token && refresh_token) {
      setTokens(access_token, refresh_token)
    }
    
    return {
      access_token,
      refresh_token
    }
  },
  loader: async () => {
    throw redirect({
      to:'/'
    })
  }
})

function RouteComponent() {
  return <div>Processing authentication...</div>
}
