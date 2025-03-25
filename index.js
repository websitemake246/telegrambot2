const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('7796296618:AAF97AYhvWFuM8Z4KvaDfgRx7_-3_RsWooA'); // Replace with your bot token
const dbFile = 'data.json';

// Ensure data.json exists
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: {}, botOn: true }, null, 2));
}

let db = JSON.parse(fs.readFileSync(dbFile));
const ADMINS = ["6854166132", "6985047327"];
const LORD = "7316978700";

// Save database function
const saveDB = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));

// Ensure user exists in DB
const ensureUser = (id) => {
    if (!db.users[id]) {
        db.users[id] = { balance: 100, invested: 0, pendingProfit: 0, claimCount: 0, lastInvestTime: 0, claimEnabled: true };
    }
};

// Investment processing function
const processInvestments = () => {
    if (!db.botOn) return; // Stop if bot is off

    for (let userId in db.users) {
        let user = db.users[userId];

        if (user.invested > 0) {
            let change = Math.random() < 0.5 ? 0.1 : -0.05; // 50% chance of 10% profit or 5% loss
            let profitOrLoss = Math.floor(user.invested * change);

            user.pendingProfit += profitOrLoss;
            user.claimCount += 1;

            if (user.claimEnabled && user.claimCount <= 6) {
                bot.telegram.sendMessage(userId, `⏳ Your investment has changed! Use /claim to collect.`);
            }
        }
    }
    saveDB();
};

// Run investment updates every 3 minutes
setInterval(processInvestments, 3 * 60 * 1000);

// /on command (Only Lord)
bot.command('on', (ctx) => {
    if (ctx.from.id.toString() !== LORD) return ctx.reply("❌ Only the Lord can turn on the bot.");

    db.botOn = true;
    saveDB();
    ctx.reply("✅ Bot is now ON!");
});

// /off command (Only Lord)
bot.command('off', (ctx) => {
    if (ctx.from.id.toString() !== LORD) return ctx.reply("❌ Only the Lord can turn off the bot.");

    db.botOn = false;
    saveDB();
    ctx.reply("🚨 Bot is now OFF!");
});

// /start command (Menu)
bot.command('start', (ctx) => {
    ctx.reply(`📌 Welcome to Navigator Pay!\n\nHere are the available commands:\n\n
    💰 **Investing**  
    ➤ /invest [amount] - Invest coins  
    ➤ /claim - Claim profit/loss  
    ➤ /balance - Check your balance  

    🎁 **Bonuses**  
    ➤ /dailyinvestbonus - Get 50 coins daily  

    🔁 **Transactions**  
    ➤ /sendcoin @user [amount] - Send coins  
    ➤ /leaderboard - Top coin holders  

    ⚙️ **Settings**  
    ➤ /stopclaim - Disable claim reminders  
    ➤ /startclaim - Enable claim reminders  

    🔥 **Admin Commands** (For Admins Only)  
    ➤ /sendcoin @user [amount] - Send unlimited coins  

    🛠 **Lord Commands** (Only Lord)  
    ➤ /on - Turn on bot  
    ➤ /off - Turn off bot`);
});

// /stopclaim command
bot.command('stopclaim', (ctx) => {
    let id = ctx.from.id.toString();
    ensureUser(id);

    db.users[id].claimEnabled = false;
    saveDB();
    ctx.reply("✅ Claim reminders disabled.");
});

// /startclaim command
bot.command('startclaim', (ctx) => {
    let id = ctx.from.id.toString();
    ensureUser(id);

    db.users[id].claimEnabled = true;
    saveDB();
    ctx.reply("✅ Claim reminders enabled.");
});

// /invest command
bot.command('invest', (ctx) => {
    if (!db.botOn) return ctx.reply("❌ Bot is currently OFF.");
    
    let id = ctx.from.id.toString();
    let amount = parseInt(ctx.message.text.split(" ")[1]);

    if (!amount || amount <= 0) return ctx.reply("❌ Enter a valid investment amount.");
    ensureUser(id);

    if (db.users[id].pendingProfit !== 0) return ctx.reply("⚠️ Claim your pending profit first using /claim.");

    if (db.users[id].balance < amount) return ctx.reply("❌ Insufficient balance.");

    db.users[id].balance -= amount;
    db.users[id].invested += amount;
    db.users[id].claimCount = 0;
    db.users[id].lastInvestTime = Date.now();
    saveDB();

    ctx.reply(`✅ You invested ${amount} coins! Your profit/loss updates every 3 minutes.`);
});

// /claim command
bot.command('claim', (ctx) => {
    if (!db.botOn) return ctx.reply("❌ Bot is currently OFF.");

    let id = ctx.from.id.toString();
    ensureUser(id);

    if (db.users[id].pendingProfit === 0) return ctx.reply("⚠️ No profit/loss to claim.");

    db.users[id].balance += db.users[id].pendingProfit;
    db.users[id].pendingProfit = 0;
    db.users[id].claimCount = 0;
    saveDB();

    ctx.reply(`🎉 Claimed! Check /balance.`);
});

// /balance command
bot.command('balance', (ctx) => {
    let id = ctx.from.id.toString();
    ensureUser(id);

    ctx.reply(`💰 Balance: ${db.users[id].balance} coins\n📊 Invested: ${db.users[id].invested} coins\n⏳ Pending Profit/Loss: ${db.users[id].pendingProfit} coins`);
});

// /leaderboard command
bot.command('leaderboard', (ctx) => {
    let leaderboard = Object.entries(db.users)
        .sort((a, b) => b[1].balance - a[1].balance)
        .map(([id, data], index) => `${index + 1}. User ${id} - ${data.balance} coins`)
        .slice(0, 10)
        .join("\n");

    ctx.reply(leaderboard ? `🏆 Leaderboard:\n${leaderboard}` : "No data yet.");
});

// /sendcoin command
bot.command('sendcoin', (ctx) => {
    if (!db.botOn) return ctx.reply("❌ Bot is currently OFF.");

    let senderId = ctx.from.id.toString();
    let args = ctx.message.text.split(" ");
    let receiverId = args[1]?.replace("@", "");
    let amount = parseInt(args[2]);

    if (!receiverId || !amount || amount <= 0) return ctx.reply("❌ Usage: /sendcoin @username amount");
    ensureUser(senderId);
    ensureUser(receiverId);

    if (ADMINS.includes(senderId)) {
        db.users[receiverId].balance += amount;
    } else {
        if (db.users[senderId].balance < amount) return ctx.reply("❌ Insufficient balance.");
        db.users[senderId].balance -= amount;
        db.users[receiverId].balance += amount;
    }

    saveDB();
    ctx.reply(`✅ Sent ${amount} coins to ${receiverId}!`);
});

// /dailyinvestbonus command
bot.command('dailyinvestbonus', (ctx) => {
    let id = ctx.from.id.toString();
    ensureUser(id);

    db.users[id].balance += 50;
    saveDB();
    ctx.reply("🎉 50 daily bonus coins received!");
});

// Start bot
bot.launch().then(() => console.log("✅ Navigator Pay bot is running..."));
