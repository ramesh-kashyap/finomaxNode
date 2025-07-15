const { User, Investment,Income,Withdraw,Machine} = require("../models"); // Adjust path as needed
const { Op } = require("sequelize"); // ✅ Import Sequelize Operators
const nodemailer = require("nodemailer");
const BuyFund = require("../models/BuyFunds");

// Get user's VIP level

async function getVip(userId) {
    try {
        const user = await User.findByPk(userId);
        if (!user) return 0;

        const levelTeam = await myLevelTeamCount(user.id);
        const genTeam = {
            1: levelTeam[1] || [],
            2: levelTeam[2] || [],
            3: levelTeam[3] || []
        };

        // Count active users in gen1 and gen2+gen3 (no package amount check)
        const gen1Count = await User.count({
            where: {
                id: genTeam[1],
                active_status: "Active",
                package : {[Op.gte]:100}
            }
        });

        const gen2_3Count = await User.count({
            where: {
                id: [...genTeam[2], ...genTeam[3]],
                active_status: "Active",
                package : {[Op.gte]:100}
            }



            
        });





        const userBalance = await getDeposit(userId);

        
        let vipLevel = 0;

        if (userBalance >= 50) {
            vipLevel = 1;
        }
        if (userBalance >= 501 && gen1Count >= 3 && gen2_3Count >= 6) {
            vipLevel = 2;
        }
        if (userBalance >= 2001 && gen1Count >= 10 && gen2_3Count >= 25) {
            vipLevel = 3;
        }
        if (userBalance >= 5001 && gen1Count >= 20 && gen2_3Count >= 75) {
            vipLevel = 4;
        }
         if (userBalance >= 10001 && gen1Count >=25 && gen2_3Count >= 125) {
            vipLevel = 5;
        }
         if (userBalance >= 25000 && gen1Count >=30 && gen2_3Count >= 250) {
            vipLevel = 6;
        }
        return vipLevel;

    } catch (error) {
        console.error("Error in getVip:", error);
        return 0;
    }
}

// Get user's level team count (downline up to 'level' generations)
async function myLevelTeamCount(userId, level = 3) {
    try {
        let currentLevelUsers = [userId];
        let team = {};
        for (let i = 1; i <= level; i++) {
            const downline = await User.findAll({
                attributes: ["id"],
                where: { sponsor: currentLevelUsers }
            });

            if (downline.length === 0) break;
            currentLevelUsers = downline.map(user => user.id);
            team[i] = currentLevelUsers;
        }

        return team;
    } catch (error) {
        console.error("Error in myLevelTeamCount:", error);
        return {};
    }
}

// Get user's balance (active investments)

async function getBalance(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) return 0;

    // 1) grab the raw sums (could be null)
    const [ totalCommissionRaw, totalWithdrawRaw ] = 
      await Promise.all([
        Income.sum('comm', {
          where: { user_id: userId }
        }),
        Withdraw.sum('amount', {
          where: {
            user_id: userId,
            status:   { [Op.ne]: 'Failed' }
          }
        })

 

      ]);

    // 2) coerce to Number, defaulting null/undefined → 0
    const totalCommission = Number(totalCommissionRaw  ?? 0);
    const totalWithdraw  = Number(totalWithdrawRaw  ?? 0);

    // 3) Now the math will never be NaN
    const totalBalance = (totalCommission) - totalWithdraw;

    // console.log("Balance:", totalBalance);
    return totalBalance.toFixed(3);
  }
  catch (error) {
    console.error("Error in getBalance:", error);
    return 0;
  }
}



async function getDeposit(userId) {
  try {
    const user = await User.findByPk(userId);
    if (!user) return 0;

   const investmentRaw = await Investment.sum('amount', {
          where: { user_id: userId, status: 'Active' }
        }); 

    const investment     = Number(investmentRaw ?? 0);
    // 3) Now the math will never be NaN
    const totalBalance = investment;

    // console.log("Balance:", investmentRaw);
    return totalBalance.toFixed(3);
  }
  catch (error) {
    console.error("Error in getBalance:", error);
    return 0;
  }
}


async function getPercentage(vipLevel) {
    try {
        let idx = (vipLevel==0)?1:vipLevel;
        const user = await Machine.findOne({where: {m_id: idx }});
        return user.m_return || 0;
    } catch (error) {
        console.error("Error in getBalance:", error);
        return 0;
    }
}


async function getQuantifition(vipLevel) {
    try {
        const user = await Machine.findOne({ where: { m_id: vipLevel } });
        return user.trade || 0;
    } catch (error) {
        // console.error("Error fetching quantification:", error);
        return 0;
    }
}


async function sendEmail(email, subject, data) {
    try {
        // ✅ Create a transporter using cPanel SMTP
        const transporter = nodemailer.createTransport({
            host: "mail.finomax.xyz", // Replace with your cPanel SMTP host
            port: 465, // Use 465 for SSL, 587 for TLS
            secure: true, // true for 465, false for 587
            auth: {
                user: "info@finomax.xyz", // Your email
                pass: "finomax@7$", // Your email password
            },
        });
        const mailOptions = {
            from: '"Finomax" <info@finomax.xyz>', // Replace with your email
            to: email,
            subject: subject,
            html: `<p>Hi ${data.name},</p>
                   <p>We’re inform you that a One-Time Password (OTP) has been generated for your account authentication. Please use the OTP below to continue with your verification process.</p>
                   <p>OTP: ${data.code}</p>`,
        };
        // ✅ Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}
async function sendEmailRegister(email, subject, data) {
    try {
        // ✅ Create a transporter using cPanel SMTP
        const transporter = nodemailer.createTransport({
            host: "mail.finomax.xyz", // Replace with your cPanel SMTP host
            port: 465, // Use 465 for SSL, 587 for TLS
            secure: true, // true for 465, false for 587
            auth: {
                user: "info@finomax.xyz", // Your email
                pass: "finomax@7$", // Your email password
            },
        });
        const mailOptions = {
            from: '"Finomax" <info@finomax.xyz>', // Replace with your email
            to: email,
            subject: subject,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #ddd; border-radius: 10px;">
                  <h2 style="color: #333; text-align: center;">Welcome to Finomax!</h2>
                
                  <p>Hi <strong>${data.name}</strong>,</p>
                
                  <p>Your registration is successful. Below are your login credentials:</p>
                
                  <div style="background-color: #f8f8f8; padding: 15px 20px; border-radius: 8px; font-size: 16px; line-height: 1.6;">
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Password:</strong> ${data.password}</p>
                  </div>
                
                  <p style="margin-top: 20px;">You can now log in and start using your account.</p>
                
                  <p style="margin-top: 30px;">Best regards,<br><strong>Finomax Team</strong></p>
                
                  <hr style="margin-top: 40px; border: none; border-top: 1px solid #ccc;" />
                  <p style="font-size: 12px; color: #888888;">If you did not request this registration, please contact us immediately.</p>
                </div>`,
        };
        // ✅ Send the email
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:", info.response);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

async function addLevelIncome(userId, amount) {
    try {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) return false;

        let userMid = user.id;
        let sponsorId;
        let cnt = 1;
        let baseAmount = amount / 100;
        const rname = user.username;
        const fullname = user.name;

        while (userMid && userMid !== 1) {
            const currentUser = await User.findOne({ where: { id: userMid } });
            sponsorId = currentUser.sponsor;
            const sponsorDetails = await User.findOne({ where: { id: sponsorId } });
             if (!sponsorDetails) break;
            let sponsorStatus = "Pending";
            let vipLevel = 0;

            if (sponsorDetails) {
                sponsorStatus = sponsorDetails.active_status;
                vipLevel = await getVip(sponsorDetails.id);
            }

            // Define multipliers for different VIP levels
            const multipliers = {
                1: [8, 2, 1],
                2: [10, 3, 2],
                3: [12, 4, 2 ],
                4: [14, 6, 4],
            };
            const currentMultipliers = multipliers[vipLevel] || [8, 2, 1]; // Default to VIP 1 multipliers

            let commission = 0;
            if (sponsorStatus === "Active" && vipLevel >= 1) {
                if (cnt === 1) commission = baseAmount * currentMultipliers[0];
                if (cnt === 2) commission = baseAmount * currentMultipliers[1];
                if (cnt === 3) commission = baseAmount * currentMultipliers[2];
              
            }
            if (sponsorId && cnt <= 3 && commission > 0) {
                // Insert income record
                await Income.create({
                    user_id: sponsorDetails.id,
                    user_id_fk: sponsorDetails.username,
                    amt: amount,
                    comm: commission,
                    remarks: "Team Commission",
                    level: cnt,
                    rname,
                    fullname,
                    ttime: new Date(),
                });

                // Update user balance
                await User.update(
                    { userbalance: sponsorDetails.userbalance + commission },
                    { where: { id: sponsorDetails.id } }
                );
            }

            userMid = sponsorDetails.id;
            cnt++;
        }

        return true;
    } catch (error) {
        console.error("Error in addLevelIncome:", error);
        return false;
    }
}


module.exports = { getVip, myLevelTeamCount, getBalance,getDeposit,getPercentage,addLevelIncome,sendEmail ,getQuantifition,sendEmailRegister};