import twilio from 'twilio';


// Twilio Credentials
// To set up environmental variables, see http://twil.io/secure


// require the Twilio module and create a REST client

function sendSms(message) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const client = twilio(accountSid, authToken);

    client.messages
        .create({
            to: '+91 6006793481',
            from: '+13192149043',
            body: `${message}`,
        })
        .then(message => console.log("Message sent: ", message.sid))
        .catch(err => console.error("Error sending SMS: ", err));
}

export default sendSms;