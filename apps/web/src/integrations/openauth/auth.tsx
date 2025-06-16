import { createClient, type Tokens } from "@openauthjs/openauth/client"
import { createContext, useContext, useEffect, useState } from "react"
import { subject } from "l1-env"

export const client = createClient({
    clientID: "nextjs",
    issuer: "http://localhost:3002",
  })

const storedToken = localStorage.getItem("token")

const AuthContext = createContext<{token: Tokens | null, setToken: (token: Tokens) => void} | null>({
  token: storedToken ? JSON.parse(storedToken) : null,
  setToken: (token: Tokens) => {
    localStorage.setItem("token", JSON.stringify(token))
  }
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export const AuthProvider = ({children}: {children: React.ReactNode}) => {
  const [token , setToken] = useState(storedToken ? JSON.parse(storedToken) : null)

  useEffect(() => {
    if (!token) {
      return
    }
    client.verify(subject, token.access).then((res) => {
      if (res.err) {
        throw res.err
      }
      if (res.tokens) {
        setToken(res.tokens)
      }
    })
    localStorage.setItem("token", JSON.stringify(token))
  }, [token])

  return <AuthContext.Provider value={{token, setToken}}>{children}</AuthContext.Provider>
}