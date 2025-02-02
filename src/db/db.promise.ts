import universalConnector from './universalConnector'

async function connect2tabulator(host = "localhost", password = "vitab1234") {
    return await universalConnector({
        host,
        database: "wisecrowbot",
        user: "sts",
        password,
        charset: "utf8mb4_unicode_ci"
    })
}

export { connect2tabulator }