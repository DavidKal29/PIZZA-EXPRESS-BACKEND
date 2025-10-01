const brevo = require('@getbrevo/brevo');
const dotenv = require('dotenv').config()

apiInstance = new brevo.TransactionalEmailsApi()

apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.APIKEY,
)

module.exports = {apiInstance,brevo}