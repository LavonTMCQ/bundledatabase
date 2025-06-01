# 🤖 Discord Bot Setup Guide

## 🎯 **Current Status**
✅ **Bot Code**: Complete and ready  
✅ **API Integration**: Connected to localhost:4000  
✅ **Database**: SQLite setup ready  
⏳ **Discord Setup**: Needs your Discord bot token  

---

## 🚀 **Quick Setup (5 minutes)**

### **Step 1: Create Discord Bot**
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Cardano Risk Bot" 
4. Go to "Bot" section
5. Click "Add Bot"
6. Copy the **Bot Token** (keep it secret!)
7. Copy the **Application ID** from General Information

### **Step 2: Configure Bot**
1. Edit `discord-bot/.env` file:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
RISK_API_URL=http://localhost:4000
DATABASE_PATH=./data/bot.db
```

### **Step 3: Deploy Commands**
```bash
cd discord-bot
npm run deploy
```

### **Step 4: Start Bot**
```bash
npm run dev
```

### **Step 5: Invite Bot to Server**
1. Go to Discord Developer Portal > OAuth2 > URL Generator
2. Select scopes: `bot` and `applications.commands`
3. Select permissions: `Send Messages`, `Use Slash Commands`, `Embed Links`
4. Copy the generated URL and open it
5. Select your server and authorize

---

## 🧪 **Test Commands**

Once the bot is running and invited:

### **Basic Test**
```
/health
```
Should show bot and API status

### **Token Analysis Test**
```
/analyze policy_id:7529bed52d81a20e69c6dd447dd9cc0293daf4577f08d7ed2d8ab081 asset_name:4d4953544552
```
Should analyze MISTER token with beautiful embed

### **GIF Configuration Test**
```
/config gif type:safe url:https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif
```
Should update safe token GIF

---

## 🎨 **Features Ready**

### ✅ **Working Commands**
- `/analyze` - Beautiful token risk analysis with custom GIFs
- `/health` - Bot and API status
- `/config gif` - Customize GIFs for different risk levels
- `/config show` - View current settings

### ✅ **Beautiful Embeds**
- Risk-based colors (Green/Yellow/Red)
- Custom GIFs for each risk level
- Professional formatting
- Cardano branding

### ✅ **Smart Features**
- Policy ID validation
- Error handling
- User preferences storage
- API integration

---

## 🔧 **Troubleshooting**

### **Bot Won't Start**
- Check Discord token in `.env`
- Make sure API is running on localhost:4000
- Check console for error messages

### **Commands Not Showing**
- Run `npm run deploy` to register commands
- Wait 1-2 minutes for Discord to update
- Try in a different server

### **Analysis Fails**
- Verify API is running: `curl http://localhost:4000/health`
- Check policy ID format (56 hex characters)
- Check console logs for API errors

---

## 🎯 **Next Steps**

Once basic bot is working:

1. **Test with your agent** - Verify integration
2. **Customize GIFs** - Set your preferred risk level GIFs  
3. **Add to team servers** - Invite to your Discord servers
4. **Phase 2 Development** - Watchlists and alerts

---

## 📞 **Support**

If you encounter issues:
1. Check console logs for errors
2. Verify API is running and accessible
3. Ensure Discord permissions are correct
4. Test with simple commands first

**The bot is ready to go! Just need your Discord setup! 🚀**
