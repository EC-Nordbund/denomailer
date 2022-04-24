import { ResolvedSendConfig } from "./mail/mod.ts";

export interface ResolvedClientOptions {
  debug: {
    log: boolean;
    allowUnsecure: boolean;
    encodeLB: boolean;
    noStartTLS: boolean;
  };
  connection: {
    hostname: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
    tls: boolean;
  };
  pool?: {
    size: number;
    timeout: number;
  };
  client: {
    warning: "ignore" | "log" | "error";
    preprocessors: Preprocessor[];
  };
}

/**
 * Options to create a new SMTP CLient
 */
export interface ClientOptions {
  debug?: {
    /**
     * USE WITH COUTION AS THIS WILL LOG YOUR USERDATA AND ALL MAIL CONTENT TO STDOUT!
     * @default false
     */
    log?: boolean;
    /**
     * USE WITH COUTION AS THIS WILL POSIBLY EXPOSE YOUR USERDATA AND ALL MAIL CONTENT TO ATTACKERS!
     * @default false
     */
    allowUnsecure?: boolean;
    /**
     * USE WITH COUTION AS THIS COULD INTODRUCE BUGS
     *
     * This option is mainly to allow debuging to exclude some possible problem surfaces at encoding
     * @default false
     */
    encodeLB?: boolean;
    /**
     * Disable starttls
     */
    noStartTLS?: boolean;
  };
  connection: {
    hostname: string;
    /**
     * For TLS the default port is 465 else 25.
     * @default 25 or 465
     */
    port?: number;
    /**
     * authentication data
     */
    auth?: {
      username: string;
      password: string;
    };
    /**
     * Set this to `true` to connect via SSL / TLS if set to `false` STARTTLS is used.
     * Only if `allowUnsecure` is used userdata or mail content could be exposed!
     *
     * @default false
     */
    tls?: boolean;
  };
  /**
   * Create multiple connections so you can send emails faster!
   */
  pool?: {
    /**
     * Number of Workers
     * @default 2
     */
    size?: number;
    /**
     * Time the connection has to be idle to be closed. (in ms)
     * If a value > 1h is set it will be set to 1h
     * @default 60000
     */
    timeout?: number;
  } | boolean;
  client?: {
    /**
     * There are some cases where warnings are created. These are loged by default but you can 'ignore' them or all warnings should be considered 'error'.
     *
     * @default log
     */
    warning?: "ignore" | "log" | "error";
    /**
     * List of preproccessors to
     *
     * - Filter mail
     * - BCC all mails to someone
     * - ...
     */
    preprocessors?: Preprocessor[];
  };
}

type Preprocessor = (
  mail: ResolvedSendConfig,
  client: ResolvedClientOptions,
) => ResolvedSendConfig;

export function resolveClientOptions(
  config: ClientOptions,
): ResolvedClientOptions {
  return {
    debug: {
      log: config.debug?.log ?? false,
      allowUnsecure: config.debug?.allowUnsecure ?? false,
      encodeLB: config.debug?.encodeLB ?? false,
      noStartTLS: config.debug?.noStartTLS ?? false,
    },
    connection: {
      hostname: config.connection.hostname,
      port: config.connection.port ?? (config.connection.tls ? 465 : 25),
      tls: config.connection.tls ?? false,
      auth: config.connection.auth,
    },
    pool: (config.pool
      ? (config.pool === true
        ? {
          size: 2,
          timeout: 60000,
        }
        : {
          size: config.pool.size ?? 2,
          timeout: config.pool.timeout ?? 60000,
        })
      : undefined),
    client: {
      warning: config.client?.warning ?? "log",
      preprocessors: config.client?.preprocessors ?? [],
    },
  };
}
