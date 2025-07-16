export type SmtpConfig = {
  host: string
  port: number
  username: string
  authorization_code: string
  secure: boolean
  cc: string[]      // CC recipients list
} 