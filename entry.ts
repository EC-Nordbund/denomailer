import { SendConfig } from "./config.ts";
import { SMTPWorker, SMTPWorkerPool } from "./pool.ts";
import { SmtpClient } from "./smtp.ts";

export interface ResolvedClientOptions {
  debug: {
    log: boolean
    allowUnsecure: boolean,
    encodeLB: boolean
  },
  connection: {
    hostname: string,
    port: number
    auth?: {
      username: string
      password: string
    }
    tls: boolean
  },
  pool?: {
    size: number
    timeout: number 
  }
}

export interface ClientOptions {
  debug?: {
    /**
     * USE WITH COUTION AS THIS WILL LOG YOUR USERDATA AND ALL MAIL CONTENT TO STDOUT!
     * @default false
     */
    log?: boolean
    /**
     * USE WITH COUTION AS THIS WILL POSIBLY EXPOSE YOUR USERDATA AND ALL MAIL CONTENT TO ATTACKERS!
     * @default false
     */
    allowUnsecure?: boolean,
    /**
     * USE WITH COUTION AS THIS COULD INTODRUCE BUGS
     * 
     * This option is mainly to allow debuging to exclude some possible problem surfaces at encoding
     * @default false
     */
    encodeLB?: boolean
  },
  connection: {
    hostname: string,
    /**
     * For TLS the default port is 465 else 25.
     * @default 25 or 465
     */
    port?: number
    /**
     * authentication data
     */
    auth?: {
      username: string
      password: string
    }
    /**
     * Set this to `true` to connect via SSL / TLS if set to `false` STARTTLS is used.
     * Only if `allowUnsecure` is used userdata or mail content could be exposed!
     * 
     * @default false
     */
    tls?: boolean
  },
  pool?: {
    /**
     * Number of Workers
     * @default 2
     */
    size?: number
    /**
     * Time the connection has to be idle to be closed. (in ms)
     * If a value > 1h is set it will be set to 1h
     * @default 60000
     */
    timeout?: number 
  } | boolean
}


export function createSMTPConnection(config: ClientOptions): SMTPHandler {
  const newConfig: ResolvedClientOptions = {
    debug: {
      log: config.debug?.log ?? false,
      allowUnsecure: config.debug?.allowUnsecure ?? false,
      encodeLB: config.debug?.encodeLB ?? false
    },
    connection: {
      hostname: config.connection.hostname,
      port: config.connection.port ?? (config.connection.tls ? 465 : 25),
      tls: config.connection.tls ?? false,
      auth: config.connection.auth
    },
    pool: (config.pool ? (config.pool === true ? {
      size: 2,
      timeout: 60000
    } : {
      size: config.pool.size ?? 2,
      timeout: config.pool.timeout ?? 60000
    }) : undefined)
  }

  if(newConfig.debug?.log) {
    console.log('used resolved config')
    console.log('.debug')
    console.table(newConfig.debug)
    console.log('.connection')
    console.table({...newConfig.connection, ...newConfig.connection.auth ? {auth: JSON.stringify(newConfig.connection.auth)} : {}})
    console.log('.pool')
    console.table(newConfig.pool)
  }


  const Client = newConfig.pool ? (newConfig.pool.size > 1 ? SMTPWorkerPool : SMTPWorker) : SmtpClient

  const handler = new Client(newConfig)

  return handler
}

export interface SMTPHandler {
  send(config: SendConfig): Promise<void>
  close(): void
}
