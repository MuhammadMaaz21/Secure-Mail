const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../src/models/User');
const Email = require('../src/models/Email');
const UserSettings = require('../src/models/UserSettings');
const { analyzeEmail } = require('../src/utils/aiAnalysis');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/secure-mail';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB connected successfully\n');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

const TEST_USERS = [
  { email: 'alice@test.com', password: 'Test1234' },
  { email: 'bob@test.com', password: 'Test1234' },
  { email: 'charlie@test.com', password: 'Test1234' },
  { email: 'diana@test.com', password: 'Test1234' },
  { email: 'eve@test.com', password: 'Test1234' }
];

const TEST_EMAILS = [
  // Normal emails
  {
    from: 'alice@test.com',
    to: ['bob@test.com'],
    subject: 'Meeting Tomorrow',
    body: 'Hi Bob, I wanted to confirm our meeting tomorrow at 2 PM. Please let me know if that works for you. Best regards, Alice',
    type: 'normal'
  },
  {
    from: 'bob@test.com',
    to: ['alice@test.com'],
    subject: 'Re: Meeting Tomorrow',
    body: 'Hi Alice, Yes, 2 PM works perfectly for me. Looking forward to it! Thanks, Bob',
    type: 'normal'
  },
  {
    from: 'charlie@test.com',
    to: ['diana@test.com', 'eve@test.com'],
    subject: 'Project Update',
    body: 'Hello team, I wanted to provide an update on the project status. We are making good progress and should be ready for review next week. Regards, Charlie',
    type: 'normal'
  },
  {
    from: 'diana@test.com',
    to: ['alice@test.com'],
    subject: 'Lunch Invitation',
    body: 'Hi Alice, Would you like to join me for lunch this Friday? Let me know what time works for you. Best, Diana',
    type: 'normal'
  },
  // Spam emails (from test users to simulate spam)
  {
    from: 'eve@test.com',
    to: ['alice@test.com', 'bob@test.com', 'charlie@test.com'],
    subject: 'FREE MONEY!!! LIMITED TIME OFFER!!!',
    body: 'CONGRATULATIONS! You have WON $1,000,000! Click here NOW to claim your prize! This is a LIMITED TIME offer! ACT NOW! Don\'t miss out on this AMAZING opportunity!',
    type: 'spam'
  },
  {
    from: 'diana@test.com',
    to: ['alice@test.com', 'eve@test.com'],
    subject: 'Exclusive Deal - 90% OFF!',
    body: 'Hi! We have an INCREDIBLE offer just for you! Get 90% OFF on all products! This is a ONCE IN A LIFETIME deal! ORDER NOW before it\'s too late! Make money from home!',
    type: 'spam'
  },
  {
    from: 'charlie@test.com',
    to: ['alice@test.com'],
    subject: 'You Won! Claim Your Prize!',
    body: 'CONGRATULATIONS! You are a WINNER! Claim your GUARANTEED prize NOW! No risk! Special offer! Click here to get your FREE prize!',
    type: 'spam'
  },
  // Phishing emails (from test users to simulate phishing)
  {
    from: 'bob@test.com',
    to: ['alice@test.com'],
    subject: 'URGENT: Verify Your Account Now',
    body: 'Your account has been SUSPENDED due to suspicious activity. You must VERIFY your account IMMEDIATELY or it will be LOCKED. Click here to CONFIRM your identity. This is URGENT - immediate action required.',
    type: 'phishing'
  },
  {
    from: 'alice@test.com',
    to: ['charlie@test.com', 'diana@test.com'],
    subject: 'Security Alert: Unauthorized Access Detected',
    body: 'We detected UNAUTHORIZED access to your account. Please VERIFY your account NOW to prevent it from being CLOSED. Click to CONFIRM your identity. Account verification required immediately.',
    type: 'phishing'
  },
  {
    from: 'bob@test.com',
    to: ['eve@test.com'],
    subject: 'Account Expired - Update Required',
    body: 'Your account has EXPIRED. You must UPDATE your information immediately. Click here to VERIFY and CONFIRM your account. Security breach detected - verify now!',
    type: 'phishing'
  },
  // Mixed emails between test users
  {
    from: 'eve@test.com',
    to: ['alice@test.com'],
    subject: 'Question About the Project',
    body: 'Hi Alice, I have a question about the project we discussed. Could you please clarify the requirements? Thank you, Eve',
    type: 'normal'
  },
  {
    from: 'alice@test.com',
    to: ['charlie@test.com'],
    subject: 'Follow Up',
    body: 'Hi Charlie, Just following up on our conversation. Please let me know when you have an update. Best, Alice',
    type: 'normal'
  }
];

const seedTestData = async () => {
  try {
    await connectDB();

    console.log('🗑️  Cleaning existing test data...');
    // Delete test users
    await User.deleteMany({ email: { $in: TEST_USERS.map(u => u.email) } });
    // Delete test emails
    await Email.deleteMany({ 
      $or: [
        { senderEmail: { $in: TEST_USERS.map(u => u.email) } },
        { to: { $in: TEST_USERS.map(u => u.email) } }
      ]
    });
    console.log('✅ Cleaned existing test data\n');

    console.log('👤 Creating test users...');
    const createdUsers = [];
    for (const userData of TEST_USERS) {
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        console.log(`   ⚠️  User ${userData.email} already exists, skipping...`);
        createdUsers.push(existingUser);
        continue;
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(userData.password, saltRounds);
      
      const user = new User({
        email: userData.email,
        passwordHash,
        emailVerified: true
      });
      
      await user.save();
      createdUsers.push(user);
      console.log(`   ✅ Created user: ${userData.email}`);
    }
    console.log(`✅ Created ${createdUsers.length} test users\n`);

    console.log('📧 Creating test emails...');
    let emailCount = 0;
    
    for (const emailData of TEST_EMAILS) {
      // Find sender user
      const sender = createdUsers.find(u => u.email === emailData.from);
      if (!sender) {
        console.log(`   ⚠️  Sender ${emailData.from} not found, skipping...`);
        continue;
      }

      // Find recipient users
      const recipients = emailData.to.map(email => 
        createdUsers.find(u => u.email === email)
      ).filter(Boolean);

      if (recipients.length === 0) {
        console.log(`   ⚠️  No valid recipients for email from ${emailData.from}, skipping...`);
        continue;
      }

      // Analyze email for spam/phishing
      const analysis = analyzeEmail({
        subject: emailData.subject,
        body: emailData.body,
        senderEmail: emailData.from
      });

      // Determine folder based on analysis and type
      let folder = 'inbox';
      if (emailData.type === 'spam' || analysis.spamProbability >= 50) {
        folder = 'spam';
      } else if (emailData.type === 'phishing' || analysis.isPhishing) {
        folder = 'spam'; // Phishing also goes to spam
      }

      // Create email for each recipient
      for (const recipient of recipients) {
        const email = new Email({
          senderId: sender._id,
          senderEmail: sender.email,
          senderName: sender.email.split('@')[0],
          to: [recipient.email],
          subject: emailData.subject,
          body: emailData.body,
          folder: folder,
          isRead: false,
          aiAnalysis: {
            threatLevel: analysis.threatLevel,
            confidence: analysis.confidence,
            details: analysis.details,
            spamProbability: analysis.spamProbability,
            isPhishing: analysis.isPhishing,
            tone: analysis.tone
          },
          selfDestructTimer: 'none'
        });

        await email.save();
        emailCount++;
      }

      // Create sent email for sender
      const sentEmail = new Email({
        senderId: sender._id,
        senderEmail: sender.email,
        senderName: sender.email.split('@')[0],
        to: emailData.to,
        subject: emailData.subject,
        body: emailData.body,
        folder: 'sent',
        isRead: true,
        aiAnalysis: {
          threatLevel: analysis.threatLevel,
          confidence: analysis.confidence,
          details: analysis.details,
          spamProbability: analysis.spamProbability,
          isPhishing: analysis.isPhishing,
          tone: analysis.tone
        },
        selfDestructTimer: 'none'
      });

      await sentEmail.save();
      emailCount++;
    }

    console.log(`✅ Created ${emailCount} test emails\n`);

    console.log('⚙️  Creating default settings for test users...');
    for (const user of createdUsers) {
      const existingSettings = await UserSettings.findOne({ userId: user._id });
      if (!existingSettings) {
        const settings = new UserSettings({
          userId: user._id,
          defaultSelfDestructTimer: 'none',
          blockedSenders: [],
          disableExternalImages: false,
          autoMarkSpam: true,
          autoMarkPhishing: true,
          newEmailNotifications: true,
          importantEmailAlerts: true,
          securityAlerts: true,
          language: 'en',
          timezone: 'UTC'
        });
        await settings.save();
        console.log(`   ✅ Created settings for ${user.email}`);
      }
    }
    console.log('✅ Settings created\n');

    console.log('📊 Final Statistics:');
    console.log('─'.repeat(50));
    const totalUsers = await User.countDocuments();
    const totalEmails = await Email.countDocuments();
    const inboxEmails = await Email.countDocuments({ folder: 'inbox' });
    const spamEmails = await Email.countDocuments({ folder: 'spam' });
    const sentEmails = await Email.countDocuments({ folder: 'sent' });
    
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Total Emails: ${totalEmails}`);
    console.log(`  - Inbox: ${inboxEmails}`);
    console.log(`  - Spam: ${spamEmails}`);
    console.log(`  - Sent: ${sentEmails}`);
    console.log('─'.repeat(50));
    console.log('\n✅ Test data seeding complete!');
    console.log('\n📝 Test Accounts:');
    TEST_USERS.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} / ${user.password}`);
    });

  } catch (error) {
    console.error('❌ Error seeding test data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

seedTestData();

