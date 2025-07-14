const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Income = require('../models/Income');
const Withdraw = require('../models/Withdraw');
const BuyFund = require('../models/BuyFunds');
const Server = require('../models/Servers');
const Trade = require('../models/Trade');
const Machines = require('../models/Machines');
const { calculateAvailableBalance } = require("../helper/helper");
const axios = require('axios');
const sequelize = require('../config/connectDB');
const Investment = require('../models/Investment');
const crypto = require('crypto');
const Notification = require('../models/Notification');
const { addNotification } = require('../helper/helper');
const { getBalance ,sendEmail } = require("../services/userService");
const moment = require('moment');
const { Op } = require('sequelize');
const logger = require("../../utils/logger");

const rapidrice = async (req, res) => {
  try {
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const user = await User.findOne({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const currentDate =  new Date(user.created_at);
    console.log(createdAt,currentDate);
    const diffDays = Math.floor((currentDate - createdAt) / (1000 * 60 * 60 * 24));
    
    const team = await User.findAll({
      where: { sponsor: userId, active_status: 'Active' }
    });
    console.log(diffDays, team.length);
    const teamSize = team.length;

    const bonusTable = [
      { teamSize: 2, days: 2, bonus: 15 },
      { teamSize: 5, days: 7, bonus: 35 },
      { teamSize: 10, days: 20, bonus: 50 },
      { teamSize: 15, days: 30, bonus: 75 },
      { teamSize: 20, days: 40, bonus: 100 },
      { teamSize: 25, days: 50, bonus: 125 },
      { teamSize: 30, days: 60, bonus: 150 },
      { teamSize: 50, days: 100, bonus: 300 },
      { teamSize: 75, days: 150, bonus: 500 },
      { teamSize: 100, days: 200, bonus: 1000 },
    ];

    let eligibleBonus = null;
    for (let i = bonusTable.length - 1; i >= 0; i--) {
      if (teamSize >= bonusTable[i].teamSize && diffDays <= bonusTable[i].days) {
        eligibleBonus = bonusTable[i];
        break;
      }
    }

    if (!eligibleBonus) {
      return res.status(200).json({ success: false, message: "Not eligible for Rapid Rise Bonus." });
    }

    const alreadyReceived = await Income.findOne({
      where: {
        user_id: userId,
        comm: eligibleBonus.bonus,
        remarks: "Rapid Rise Bonus"
      }
    });

    if (alreadyReceived) {
      return res.status(200).json({ success: false, message: "Bonus already received." });
    }

    await Income.create({
      comm: eligibleBonus.bonus,
      user_id: userId,
      user_id_fk: user.username,
      remarks: "Rapid Rise Bonus"
    });

    
    return res.status(200).json({
      success: true,
      message: `Bonus of $${eligibleBonus.bonus} credited.`,
      bonus: eligibleBonus.bonus
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};




module.exports = {rapidrice};