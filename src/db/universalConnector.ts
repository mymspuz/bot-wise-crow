import path from 'path'
import fs from 'fs'
import dotenv, { DotenvParseOutput } from 'dotenv'
import mysql, { Pool } from 'mysql2/promise'

type TAddOptions = {
    envFilePath?: string
    envFileName?: string
    database?: string
    host?: string
    user?: string
    port?: number | string
    password?: string
    charset?: string
    useTLS?: string
    sslCAPath?: string
    sslKeyPath?: string
    sslCertPath?: string
}

async function universalConnector(appOptions: TAddOptions = {}): Promise<Pool> {
    const envFilePath = process.env.DB_ENV_PATH || appOptions.envFilePath || "/home/user1/.credentials/";
    const envFileName =
        appOptions.envFileName ||
        process.env.DB_ENV_FILE ||
        (process.env.DB_ENV_PATH?.slice(-1) === "/" ? `${process.env.DB_DATABASE || appOptions.database || "db"}.env` : "");
    const fullEnvPath = path.join(envFilePath, envFileName);

    let envConfig: DotenvParseOutput = {};
    try {
        if (fs.existsSync(fullEnvPath)) {
            envConfig = dotenv.parse(fs.readFileSync(fullEnvPath, "utf8"));
        }
    } catch (e) {
        console.error(e);
        envConfig = {};
    }

    const options = {
        host: envConfig.DB_HOST || appOptions.host || "localhost",
        user: envConfig.DB_USER || appOptions.user || "sts",
        port: envConfig.DB_PORT || appOptions.port || 3306,
        password: envConfig.DB_PASSWORD || appOptions.password || "",
        database: envConfig.DB_DATABASE || appOptions.database || "tabulator",
        charset: envConfig.DB_CHARSET || appOptions.charset || "utf8mb4_unicode_ci",
        useTLS: envConfig.DB_USE_TLS ? envConfig.DB_USE_TLS === "true" : appOptions.useTLS,
        sslCAPath: envConfig.DB_SSL_CA_PATH || appOptions.sslCAPath,
        sslKeyPath: envConfig.DB_SSL_KEY_PATH || appOptions.sslKeyPath,
        sslCertPath: envConfig.DB_SSL_CERT_PATH || appOptions.sslCertPath,
    };

    const connectionConfig = {
        host: options.host,
        user: options.user,
        port: Number(options.port),
        password: options.password,
        database: options.database,
        charset: options.charset,
        // ssl: {}
    };

    // if (options.useTLS && options.sslCAPath && options.sslKeyPath && options.sslCertPath) {
    //     try {
    //         connectionConfig.ssl = {
    //             ca: fs.readFileSync(options.sslCAPath),
    //             key: fs.readFileSync(options.sslKeyPath),
    //             cert: fs.readFileSync(options.sslCertPath),
    //         };
    //     } catch (e) {
    //         connectionConfig.ssl = {};
    //     }
    // }

    return mysql.createPool(connectionConfig)
}

export default universalConnector