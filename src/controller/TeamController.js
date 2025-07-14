
const Income = require('../models/Income');
const Withdraw = require('../models/Withdraw');
const Investment = require('../models/Investment');
const User = require('../models/User');
const BuyFund = require('../models/BuyFunds');
const Trade = require('../models/Trade');
const { Op } = require('sequelize');
const jwt = require("jsonwebtoken");
const authMiddleware = require('../middleware/authMiddleware');

const getAvailableBalance = async (userId) => {
    if (!userId) {
        throw new Error("User not authenticated");
    }

    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
        throw new Error("User not found");
    }

    const totalCommission = await Income.sum('comm', { where: { user_id: userId } }) || 0;
    const buyFunds = await BuyFund.sum('amount', { where: { user_id: userId } }) || 0;
    const investment = await Investment.sum('amount', { where: { user_id: userId } }) || 0;
    const totalWithdraw = await Withdraw.sum('amount', { where: { user_id: userId } }) || 0;
    const Rtrades = await Trade.sum('amount', { where: { user_id: userId, status: "Running" } }) || 0;
    const Ctrades = await Trade.sum('amount', { where: { user_id: userId, status: "Complete" } }) || 0;

    const availableBal = totalCommission + buyFunds + Ctrades - totalWithdraw - investment - Rtrades;

    return parseFloat(availableBal.toFixed(2));
};

const getIncome = async (userId, userName, loginId) => {
    if (!userId) throw new Error("User not authenticated");

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const yesterdayEnd = new Date(todayStart); // today 00:00 is end of yesterday

    // Yesterday's Commission
    const yesterdayCommission = await Income.sum('comm', {
        where: {
            user_id: loginId,
            rname: userName,
            remarks: "Team Commission",
            created_at: {
                [Op.between]: [yesterdayStart, yesterdayEnd],
            },
        },
    }) || 0;

    // Today's Commission
    const todayCommission = await Income.sum('comm', {
        where: {
            user_id: loginId,
            rname: userName,
            remarks: "Team Commission",
            created_at: {
                [Op.gte]: todayStart,
            },
        },
    }) || 0;

    // Total Commission
    const totalCommission = await Income.sum('comm', {
        where: {
            user_id: loginId,
            rname: userName,
            remarks: "Team Commission",
        },
    }) || 0;

    return {
        todayCommission: parseFloat(todayCommission.toFixed(6)),
        yesterdayCommission: parseFloat(yesterdayCommission.toFixed(6)),
        totalCommission: parseFloat(totalCommission.toFixed(6)),
    };
};

const getUsersByIds = async (ids) => {
    return ids.length ? await User.findAll({ where: { id: { [Op.in]: ids } }, order: [['id', 'DESC']] }) : [];
};

const getTeamStats = async (team) => {
    if (team.length === 0) return { recharge: 0, withdraw: 0 };

    const usernames = team.map(user => user.username);

    const [recharge, withdraw] = await Promise.all([
        Investment.sum('amount', { where: { user_id_fk: { [Op.in]: usernames }, status: 'Active' } }),
        Withdraw.sum('amount', { where: { user_id_fk: { [Op.in]: usernames }, status: 'Approved' } })
    ]);

    return { recharge, withdraw };
};

const myLevelTeam = async (userId, level = 3) => {
    let arrin = [userId];
    let ret = {};
    let i = 1;

    while (arrin.length > 0) {
        const allDown = await User.findAll({
            attributes: ['id'],
            where: { sponsor: { [Op.in]: arrin } }
        });

        if (allDown.length > 0) {
            arrin = allDown.map(user => user.id);
            ret[i] = arrin;
            i++;
            if (i > level) break;
        } else {
            arrin = [];
        }
    }
    return Object.values(ret).flat();
};

const myLevelTeamCount2 = async (userId, level = 3) => {
    let arrin = [userId];
    let ret = {};
    let i = 1;

    while (arrin.length > 0) {
        const allDown = await User.findAll({
            attributes: ['id'],
            where: { sponsor: { [Op.in]: arrin } }
        });

        if (allDown.length > 0) {
            arrin = allDown.map(user => user.id);
            ret[i] = arrin;
            i++;
            if (i > level) break;
        } else {
            arrin = [];
        }
    }
    return ret;
};



const getTeam = async (req, res) => {
    try {
        const user = req.user; // 🔹 Get authenticated user (Assuming JWT middleware is used)   
        const userId = user.id;

        if (!userId) {
            return res.status(200).json({ error: "Unauthorized: User not found" });
        }

        const ids = await myLevelTeam(userId);
        const myLevelTeamCount = await myLevelTeamCount2(userId);

        const genTeam1 = myLevelTeamCount[1] || [];
        const genTeam2 = myLevelTeamCount[2] || [];
        const genTeam3 = myLevelTeamCount[3] || [];
        const genTeam4 = myLevelTeamCount[4] || [];
        const genTeam5 = myLevelTeamCount[5] || [];

        const notes = await User.findAll({
            where: { id: ids.length ? { [Op.in]: ids } : null },
            order: [['id', 'DESC']]
        });

        const [team1, team2, team3, team4, team5] = await Promise.all([
            getUsersByIds(genTeam1),
            getUsersByIds(genTeam2),
            getUsersByIds(genTeam3),
            getUsersByIds(genTeam4),
            getUsersByIds(genTeam5),
        ]);

        const [team1Stats, team2Stats, team3Stats, team4Stats, team5Stats] = await Promise.all([
            getTeamStats(team1),
            getTeamStats(team2),
            getTeamStats(team3),
            getTeamStats(team4),
            getTeamStats(team5),
        ]);

        const teamEarnings = {};
        for (let level = 1; level <= 5; level++) {
            teamEarnings[`gen_team${level}Earning`] = await Income.sum('comm', {
                where: {
                    user_id: userId,
                    remarks: 'Team Commission',
                    level: level
                }
            });
        }

        const response = {
            gen_team1Recharge: team1Stats.recharge,
            gen_team1Withdraw: team1Stats.withdraw,
            gen_team1Earning: teamEarnings.gen_team1Earning,

            gen_team2Recharge: team2Stats.recharge,
            gen_team2Withdraw: team2Stats.withdraw,
            gen_team2Earning: teamEarnings.gen_team2Earning,

            gen_team3Recharge: team3Stats.recharge,
            gen_team3Withdraw: team3Stats.withdraw,
            gen_team3Earning: teamEarnings.gen_team3Earning,

            gen_team4Recharge: team4Stats.recharge,
            gen_team4Withdraw: team4Stats.withdraw,
            gen_team4Earning: teamEarnings.gen_team4Earning,

            gen_team5Recharge: team5Stats.recharge,
            gen_team5Withdraw: team5Stats.withdraw,
            gen_team5Earning: teamEarnings.gen_team5Earning,

            gen_team1total: team1.length,
            active_gen_team1total: team1.filter(u => u.active_status === 'Active').length,

            gen_team2total: team2.length,
            active_gen_team2total: team2.filter(u => u.active_status === 'Active').length,

            gen_team3total: team3.length,
            active_gen_team3total: team3.filter(u => u.active_status === 'Active').length,

            gen_team4total: team4.length,
            active_gen_team4total: team4.filter(u => u.active_status === 'Active').length,

            gen_team5total: team5.length,
            active_gen_team5total: team5.filter(u => u.active_status === 'Active').length,

            todaysUser: notes.filter(u => u.jdate === new Date().toISOString().split('T')[0]).length,
            totalTeam: notes.length,
            ActivetotalTeam: notes.filter(u => u.active_status === 'Active').length,

            totalLevelIncome: await Income.sum('comm', {
                where: {
                    user_id: userId,
                    remarks: 'Team Commission'
                }
            }),

            balance: parseFloat(0)
        };

        res.status(200).json({
            message: 'Fetch successfully',
            status: true,
            data: response
        });

    } catch (error) {
        console.error(error);
        res.status(200).json({
            message: 'Server error',
            status: false,
        });
    }
};




const getTeamRecord = async (req, res) => {
    try {
        const user = req.user; // 🔹 Get authenticated user (Assuming JWT middleware is used   
        const userId = user.id;

        if (!userId || !userId) {
            return res.status(200).json({ error: "Unauthorized: User not found" });
        }

        const ids = await myLevelTeam(userId);
        

         const notes = await User.findAll({
            where: { id: ids.length ? { [Op.in]: ids } : null },
            order: [['id', 'DESC']]
        });

        const totalDirect = notes.length;
        const totalActive = notes.filter(u => u.active_status === 'Active').length;
        const response = {
            totalDirect: totalDirect,
            totalActive: totalActive,
            totalLevelIncome: await Income.sum('comm', { where: { user_id: userId, remarks: 'Team Commission' } }) || 0,
        };
        res.status(200).json({
            message: 'Fetch successfully',
            status: true,
            data: response
        });

    } catch (error) {
        console.error(error);
        res.status(200).json({
            message: 'Server error',
            status: false,
        });
    }
};



const listUsers = async (req, res) => {
    try {

        const { selected_level, limit, page, search } = req.query;
        const user = req.user; // 🔹 Get authenticated user (Assuming JWT middleware is used)
        // 🔹 Fetch user's level team
        const userId = user.id;
        const myLevelTeam = await myLevelTeamCount2(user.id);

        let genTeam = {};
        if (selected_level > 0) {
            genTeam = myLevelTeam[selected_level] || [];
        } else {
            genTeam = myLevelTeam[1];
        }
        // console.log(selected_level);

        // 🔹 Query to get users
        let whereCondition = {
            [Op.or]: [],
        };

        if (Object.keys(genTeam).length > 0) {
            Object.values(genTeam).forEach((value) => {
                if (Array.isArray(value)) {
                    whereCondition[Op.or].push({ id: { [Op.in]: value } });
                } else {
                    whereCondition[Op.or].push({ id: value });
                }
            });
        } else {
            whereCondition = { id: null };
        }

        // 🔹 Add search filter if applicable
        if (search && req.query.reset !== "Reset") {
            whereCondition[Op.or].push(
                { name: { [Op.like]: `%${search}%` } },
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } },
                { jdate: { [Op.like]: `%${search}%` } },
                { active_status: { [Op.like]: `%${search}%` } }
            );
        }

        // 🔹 Fetch data with pagination
        const { count, rows } = await User.findAndCountAll({
            where: whereCondition,
            order: [["id", "DESC"]],
            limit: limit,
            offset: req.query.page ? (parseInt(req.query.page) - 1) * limit : 0,
            attributes: ['id', 'name', 'email', 'username', 'active_status', 'package', 'jdate', 'created_at', 'level'] // ← replace with the columns you want
        });

        const usersWithDetails = await Promise.all(rows.map(async (user) => {
            const { todayCommission, yesterdayCommission, totalCommission} = await getIncome(user.id, user.username, userId); // Fetch both incomes
            return {
                ...user.toJSON(),
                todayCommission: todayCommission,
                yesterdayCommission: yesterdayCommission,
                totalCommission: totalCommission,
              
            };
        }));

        return res.status(200).json({
            direct_team: usersWithDetails,
            search: search,
            page: req.query.page || 1,
            total: count,
            limit: limit,
            status: true,
        });
    } catch (error) {
        console.error("❌ Error fetching user list:", error);
        return res.status(200).json({ message: "Internal Server Error", status: false });
    }
};



const Getinvate = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated!" });
        }

        const user = await User.findOne({
            where: { id: userId },
            attributes: ['username'] // Fetch only the username
        });

        if (!user) {
            return res.status(404).json({ message: "User not found!" });
        }

        // Send the username in the response
        return res.status(200).json({
            success: true,
            data: { username: user.username }, // Include only the username
            message: "Username fetched successfully!"
        });

    } catch (error) {
        console.error("Something went wrong:", error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

//   const GetPowerTeam = async (async)=>{
//       try{
//            const userId = req.user?.id;
//        if (!userId) {
//           return res.status(200).json({ success: false, message: "Unauthorized user" });
//        }
//          const user = await User.findOne({ where: { id: userId } });
//          if(!user){
//           return res.status(200).json({ success: false, message: "User not found!" });
//          }
      

//       }
//       catch (error) {
//         console.error("Failed to update user status:", error);
//       }
//     }




module.exports = { getTeam, listUsers, Getinvate,getTeamRecord};
