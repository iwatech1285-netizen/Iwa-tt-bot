import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import dotenv from 'dotenv';
import { dbService } from '../../api/src/services/dbService.ts';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const miniappUrl =
  process.env.MINIAPP_URL ||
  process.env.APP_URL ||
  'https://ais-dev-vmfre32zy752wszrp3jxg6-967673490182.asia-southeast1.run.app';

const adsterraUrl =
  process.env.ADSTERRA_URL ||
  'https://auctionr.org/4/ad02e8c2da3bad7b121661fffaa4dbdd';

export const bot = token ? new Bot(token) : null;

if (bot) {
  // /start command
  bot.command('start', async (ctx) => {
    try {
      const from = ctx.from;
      if (!from) return;

      const payload = ctx.match; // Start parameter (e.g. ref_1234567)
      let referrerId: string | undefined;
      if (payload && payload.startsWith('ref_')) {
        referrerId = payload.replace('ref_', '');
      }

      const { balance, isNewUser } = await dbService.getOrCreateUser({
        telegramId: String(from.id),
        username: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
        languageCode: from.language_code,
        referrerId,
      });

      const keyboard = new InlineKeyboard()
        .webApp('🚀 Open IWA BOT', miniappUrl)
        .row()
        .url('🎁 Special Offer', adsterraUrl)
        .row()
        .url('👥 Community', 'https://t.me/iwacoin_community')
        .url('💬 Support', 'https://t.me/iwatech1285')
        .row()
        .text('❓ Help', 'help_info');

      let welcomeText = `Welcome to IWA BOT 🚀\n\nTap, complete tasks, invite friends and collect IWA Coins.`;
      if (isNewUser && referrerId) {
        welcomeText += `\n\n🎁 You received a 500 IWA Coin welcome bonus for joining via invitation!`;
      } else {
        welcomeText += `\n\n💰 Your Balance: ${balance.coins.toLocaleString()} IWA Coins\n⚡ Energy: ${balance.energy}/${balance.maxEnergy}`;
      }

      await ctx.reply(welcomeText, {
        reply_markup: keyboard,
      });

      // Scheduled Sponsor Offer: Send after 1 minute (60,000 ms)
      setTimeout(async () => {
        try {
          const promoKeyboard = new InlineKeyboard()
            .url('🎁 Open Sponsor Bonus Link', adsterraUrl)
            .row()
            .webApp('🚀 Open IWA BOT', miniappUrl);

          await ctx.api.sendMessage(
            from.id,
            `🎁 *Special Reward Available!*\n\nYour bonus link is ready! Tap below to open:\n\n👉 [Open Sponsor Offer](${adsterraUrl})`,
            {
              parse_mode: 'Markdown',
              reply_markup: promoKeyboard,
            }
          );
        } catch (timerErr) {
          console.error('Failed to send 1-minute sponsor bonus message:', timerErr);
        }
      }, 60 * 1000);
    } catch (err) {
      console.error('Error in /start command:', err);
      await ctx.reply('Welcome to IWA BOT! Tap below to start playing.', {
        reply_markup: new InlineKeyboard().webApp('🚀 Open IWA BOT', miniappUrl),
      });
    }
  });

  // /bonus, /ad, and /sponsor command
  bot.command(['bonus', 'ad', 'sponsor'], async (ctx) => {
    const promoKeyboard = new InlineKeyboard()
      .url('🎁 Open Sponsor Bonus Link', adsterraUrl)
      .row()
      .webApp('🚀 Open IWA BOT', miniappUrl);

    await ctx.reply(
      `🎁 *Exclusive Sponsor Offer*\n\nTap below to open your bonus sponsor offer:\n\n👉 [Open Sponsor Offer](${adsterraUrl})`,
      {
        parse_mode: 'Markdown',
        reply_markup: promoKeyboard,
      }
    );
  });

  // /app command
  bot.command('app', async (ctx) => {
    await ctx.reply('Launch the IWA BOT Mini App:', {
      reply_markup: new InlineKeyboard().webApp('🚀 Launch IWA BOT', miniappUrl),
    });
  });

  // /balance command
  bot.command('balance', async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    try {
      const balance = await dbService.getBalance(String(from.id));
      if (!balance) {
        await ctx.reply('No active account found. Tap /start to begin playing!');
        return;
      }
      await ctx.reply(
        `🪙 *IWA Coin Balance*\n\n` +
          `• Confirmed Coins: *${balance.coins.toLocaleString()}*\n` +
          `• Lifetime Earned: *${balance.totalEarned.toLocaleString()}*\n` +
          `• Current Level: *Level ${balance.level}*\n` +
          `• Energy: *${balance.energy}/${balance.maxEnergy}*`,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().webApp('⚡ Play & Earn', miniappUrl),
        }
      );
    } catch (e) {
      await ctx.reply('Could not fetch balance. Try again later.');
    }
  });

  // /referral command
  bot.command('referral', async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    try {
      const stats = await dbService.getReferralStats(String(from.id));
      const botUser = ctx.me?.username || 'iwa_tap_bot';
      const refLink = `https://t.me/${botUser}?start=ref_${from.id}`;

      await ctx.reply(
        `👥 *Invite Friends & Earn*\n\n` +
          `Share your link and earn *1,000 IWA Coins* per friend.\n` +
          `Your friends get *500 IWA Coins* welcome bonus!\n\n` +
          `• Total Friends: *${stats.totalReferrals}*\n` +
          `• Total Bonus Earned: *${stats.totalEarnedFromReferrals.toLocaleString()} IWA*\n\n` +
          `🔗 Your Referral Link:\n\`${refLink}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: new InlineKeyboard().url(
            '📤 Share Link',
            `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(
              'Join IWA BOT and claim 500 free IWA Coins! 🚀'
            )}`
          ),
        }
      );
    } catch (e) {
      await ctx.reply('Could not load referral details.');
    }
  });

  // /tasks command
  bot.command('tasks', async (ctx) => {
    try {
      const { tasks } = await dbService.getTasks();
      const activeList = tasks
        .slice(0, 5)
        .map((t) => `• *${t.title}* (+${t.rewardAmount.toLocaleString()} IWA)`)
        .join('\n');

      await ctx.reply(`📋 *Available Earn Tasks:*\n\n${activeList}\n\nComplete them in the Mini App:`, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().webApp('🚀 Open Tasks', `${miniappUrl}#earn`),
      });
    } catch (e) {
      await ctx.reply('Could not fetch tasks.');
    }
  });

  // /leaderboard command
  bot.command('leaderboard', async (ctx) => {
    try {
      const top10 = await dbService.getLeaderboard('coins', 10);
      const text = top10
        .map((e) => `#${e.rank} ${e.firstName} — ${e.score.toLocaleString()} IWA (Lvl ${e.level})`)
        .join('\n');

      await ctx.reply(`🏆 *Global Top 10 Miners:*\n\n${text}\n\nCheck full ranks in the app:`, {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().webApp('👑 Full Leaderboard', `${miniappUrl}#leaderboard`),
      });
    } catch (e) {
      await ctx.reply('Could not fetch leaderboard.');
    }
  });

  // /wallet command
  bot.command('wallet', async (ctx) => {
    await ctx.reply(
      `💼 *IWA Points Wallet*\n\n` +
        `Manage your points, review your transaction ledger, and submit withdrawal requests in the Mini App.\n\n` +
        `_Note: IWA Coin is an in-app reward point unit._`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().webApp('💼 Open Wallet', `${miniappUrl}#wallet`),
      }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📖 *IWA BOT Help & Commands*\n\n` +
        `• /start — Launch the bot and view main menu\n` +
        `• /app — Open the Telegram Mini App\n` +
        `• /balance — Check your current coin balance and energy\n` +
        `• /referral — Get your invite link and check friends\n` +
        `• /tasks — View available earning tasks\n` +
        `• /leaderboard — View global top players\n` +
        `• /wallet — Access points wallet and withdrawals\n` +
        `• /support — Contact support and community`,
      {
        parse_mode: 'Markdown',
        reply_markup: new InlineKeyboard().webApp('🚀 Launch Mini App', miniappUrl),
      }
    );
  });

  // /support command
  bot.command('support', async (ctx) => {
    await ctx.reply(`Need assistance? Reach out to our official support team:`, {
      reply_markup: new InlineKeyboard()
        .url('💬 Chat with Support', 'https://t.me/iwatech1285')
        .url('👥 Community Group', 'https://t.me/iwacoin_community'),
    });
  });

  // Callback query handler
  bot.callbackQuery('help_info', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('Tap the coin to collect IWA, complete tasks for big boosts, and invite friends to multiply earnings!');
  });

  bot.catch((err) => {
    console.error('Unhandled bot error:', err.error);
  });
}

export function startBotPolling() {
  if (!bot) {
    console.log('[Telegram Bot] TELEGRAM_BOT_TOKEN not configured. Bot polling skipped.');
    return;
  }
  bot.start({
    onStart: (info) => {
      console.log(`[Telegram Bot] Successfully started bot @${info.username}`);
    },
  });
}
