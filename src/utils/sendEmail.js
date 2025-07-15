const nodemailer = require("nodemailer");
require('dotenv').config();
const fs = require('fs');
const path = require('path');



const sendEmail = async (to, subject, message) => {
    try {
        const transporter = nodemailer.createTransport({
            host: "mail.finomax.xyz",  // ✅ Use your domain's mail server
            port: 465,  // ✅ Use SSL port for secure connections
            secure: true,
            auth: {
                user: "info@finomax.xyz",
                pass: "finomax@7$",
            },
        });

        const mailOptions = {
            from: "info@finomax.xyz",
            to,
            subject,
            html: message,
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("❌ Error sending email:", error);

        // ✅ Log the error to stderr.log
        const errorMessage = `[${new Date().toISOString()}] Error sending email to ${to}:\n${error.stack}\n\n`;
        fs.appendFileSync(logFilePath, errorMessage);

        return false;
    }
};

module.exports = sendEmail;
