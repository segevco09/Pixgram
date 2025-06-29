const mongoose = require('mongoose');

// Create a separate connection for the Chats database
const chatsConnection = mongoose.createConnection(
  process.env.MONGODB_URI ? 
    process.env.MONGODB_URI.replace('/pixgram', '/Chats') : 
    'mongodb://localhost:27017/Chats',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

chatsConnection.on('connected', () => {
  console.log('✅ Connected to Chats database successfully');
});

chatsConnection.on('error', (error) => {
  console.error('❌ Chats database connection error:', error);
});

// Schema for individual chat messages
const chatMessageSchema = new mongoose.Schema({
  senderId: {
    type: String, // Store as string ObjectId
    required: true,
    index: true
  },
  senderName: {
    type: String,
    required: true
  },
  receiverId: {
    type: String, // Store as string ObjectId
    required: true,
    index: true
  },
  receiverName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient querying
chatMessageSchema.index({ createdAt: -1 });
chatMessageSchema.index({ senderId: 1, createdAt: -1 });
chatMessageSchema.index({ receiverId: 1, isRead: 1 });

// Class to manage chat collections dynamically
class ChatManager {
  constructor() {
    this.models = new Map(); // Cache for dynamic models
  }

  // Generate consistent collection name for two users
  generateCollectionName(userId1, userId2) {
    // Validate inputs
    if (!userId1 || !userId2) {
      throw new Error(`Invalid user IDs: userId1=${userId1}, userId2=${userId2}`);
    }
    
    // Always put the smaller ID first to ensure consistency
    const sortedIds = [userId1.toString(), userId2.toString()].sort();
    return `chat_${sortedIds[0]}_${sortedIds[1]}`;
  }

  // Get or create a chat model for two users
  getChatModel(userId1, userId2) {
    const collectionName = this.generateCollectionName(userId1, userId2);
    
    // Return cached model if exists
    if (this.models.has(collectionName)) {
      return this.models.get(collectionName);
    }

    // Create new model for this chat
    const ChatModel = chatsConnection.model(collectionName, chatMessageSchema, collectionName);
    this.models.set(collectionName, ChatModel);
    
    console.log(`📁 Created/accessed chat collection: ${collectionName}`);
    return ChatModel;
  }

  // Send a message
  async sendMessage(senderId, senderName, receiverId, receiverName, content, messageType = 'text') {
    try {
      const ChatModel = this.getChatModel(senderId, receiverId);
      
      const message = new ChatModel({
        senderId: senderId.toString(),
        senderName,
        receiverId: receiverId.toString(),
        receiverName,
        content,
        messageType
      });

      await message.save();
      console.log(`💬 Message saved to collection: ${this.generateCollectionName(senderId, receiverId)}`);
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Get conversation history
  async getConversation(userId1, userId2, limit = 50, skip = 0) {
    try {
      const ChatModel = this.getChatModel(userId1, userId2);
      
      const messages = await ChatModel.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(); // Use lean() for better performance

      console.log(`📖 Retrieved ${messages.length} messages from ${this.generateCollectionName(userId1, userId2)}`);
      return messages.reverse(); // Return oldest first
    } catch (error) {
      console.error('Error getting conversation:', error);
      return [];
    }
  }

  // Mark messages as read
  async markMessagesAsRead(senderId, receiverId) {
    try {
      const ChatModel = this.getChatModel(senderId, receiverId);
      
      const result = await ChatModel.updateMany(
        {
          senderId: senderId.toString(),
          receiverId: receiverId.toString(),
          isRead: false,
          isDeleted: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );

      console.log(`✅ Marked ${result.modifiedCount} messages as read`);
      return result;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Get unread message count for a user
  async getUnreadCount(userId) {
    try {
      let totalUnread = 0;
      
      // Get all collections in the Chats database
      const collections = await chatsConnection.db.listCollections().toArray();
      
      for (const collection of collections) {
        if (collection.name.startsWith('chat_') && collection.name.includes(userId.toString())) {
          const ChatModel = this.getChatModel(userId, userId); // Just to get the model structure
          const Model = chatsConnection.model(collection.name, chatMessageSchema, collection.name);
          
          const count = await Model.countDocuments({
            receiverId: userId.toString(),
            isRead: false,
            isDeleted: false
          });
          
          totalUnread += count;
        }
      }

      console.log(`📊 User ${userId} has ${totalUnread} unread messages`);
      return totalUnread;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  // Get all conversations for a user
  async getUserConversations(userId) {
    try {
      const conversations = [];
      
      // Get all collections in the Chats database
      const collections = await chatsConnection.db.listCollections().toArray();
      
      for (const collection of collections) {
        if (collection.name.startsWith('chat_') && collection.name.includes(userId.toString())) {
          const Model = chatsConnection.model(collection.name, chatMessageSchema, collection.name);
          
          // Get the last message from this conversation
          const lastMessage = await Model.findOne({ isDeleted: false })
            .sort({ createdAt: -1 })
            .lean();

          if (lastMessage) {
            // Determine the other user
            const otherUserId = lastMessage.senderId === userId.toString() ? 
              lastMessage.receiverId : lastMessage.senderId;
            const otherUserName = lastMessage.senderId === userId.toString() ? 
              lastMessage.receiverName : lastMessage.senderName;

            // Get unread count for this conversation
            const unreadCount = await Model.countDocuments({
              receiverId: userId.toString(),
              isRead: false,
              isDeleted: false
            });

            conversations.push({
              otherUserId,
              otherUserName,
              lastMessage,
              unreadCount,
              collectionName: collection.name
            });
          }
        }
      }

      // Sort by last message timestamp
      conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
      
      console.log(`📋 Found ${conversations.length} conversations for user ${userId}`);
      return conversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  // Delete a message
  async deleteMessage(messageId, userId1, userId2) {
    try {
      const ChatModel = this.getChatModel(userId1, userId2);
      
      const result = await ChatModel.findByIdAndUpdate(
        messageId,
        { isDeleted: true },
        { new: true }
      );

      console.log(`🗑️ Message ${messageId} marked as deleted`);
      return result;
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }
}

// Export singleton instance
const chatManager = new ChatManager();

module.exports = {
  ChatManager,
  chatManager,
  chatsConnection
}; 