const mongoose = require('mongoose');

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
  console.log('Connected to Chats database successfully');
});

chatsConnection.on('error', (error) => {
  console.error('Chats database connection error:', error);
});

const chatMessageSchema = new mongoose.Schema({
  senderId: {
    type: String,
    required: true,
    index: true
  },
  senderName: {
    type: String,
    required: true
  },
  receiverId: {
    type: String,
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

chatMessageSchema.index({ createdAt: -1 });
chatMessageSchema.index({ senderId: 1, createdAt: -1 });
chatMessageSchema.index({ receiverId: 1, isRead: 1 });

class ChatManager {
  constructor() {
    this.models = new Map();
  }

  generateCollectionName(userId1, userId2) {
    if (!userId1 || !userId2) {
      throw new Error(`Invalid user IDs: userId1=${userId1}, userId2=${userId2}`);
    }
    
    const sortedIds = [userId1.toString(), userId2.toString()].sort();
    return `chat_${sortedIds[0]}_${sortedIds[1]}`;
  }

  getChatModel(userId1, userId2) {
    const collectionName = this.generateCollectionName(userId1, userId2);
    
    if (this.models.has(collectionName)) {
      return this.models.get(collectionName);
    }

    const ChatModel = chatsConnection.model(collectionName, chatMessageSchema, collectionName);
    this.models.set(collectionName, ChatModel);
    
    console.log(`📁 Created/accessed chat collection: ${collectionName}`);
    return ChatModel;
  }

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
      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  async getConversation(userId1, userId2, limit = 50, skip = 0) {
    try {
      const ChatModel = this.getChatModel(userId1, userId2);
      
      const messages = await ChatModel.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();

      return messages.reverse();
    } catch (error) {
      console.error('Error getting conversation:', error);
      return [];
    }
  }

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

      return result;
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      let totalUnread = 0;
      
      const collections = await chatsConnection.db.listCollections().toArray();
      
      for (const collection of collections) {
        if (collection.name.startsWith('chat_') && collection.name.includes(userId.toString())) {
          const ChatModel = this.getChatModel(userId, userId);
          const Model = chatsConnection.model(collection.name, chatMessageSchema, collection.name);
          
          const count = await Model.countDocuments({
            receiverId: userId.toString(),
            isRead: false,
            isDeleted: false
          });
          
          totalUnread += count;
        }
      }

      return totalUnread;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  async getUserConversations(userId) {
    try {
      const conversations = [];
      
      const collections = await chatsConnection.db.listCollections().toArray();
      
      for (const collection of collections) {
        if (collection.name.startsWith('chat_') && collection.name.includes(userId.toString())) {
          const Model = chatsConnection.model(collection.name, chatMessageSchema, collection.name);
          
          const lastMessage = await Model.findOne({ isDeleted: false })
            .sort({ createdAt: -1 })
            .lean();

          if (lastMessage) {
            const otherUserId = lastMessage.senderId === userId.toString() ? 
              lastMessage.receiverId : lastMessage.senderId;
            const otherUserName = lastMessage.senderId === userId.toString() ? 
              lastMessage.receiverName : lastMessage.senderName;

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

      conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
      
      return conversations;
    } catch (error) {
      console.error('Error getting user conversations:', error);
      return [];
    }
  }

  async editMessage(messageId, senderId, receiverId, newContent) {
    try {
      const ChatModel = this.getChatModel(senderId, receiverId);
      
      const result = await ChatModel.findOneAndUpdate(
        { 
          _id: messageId, 
          senderId: senderId.toString(),
          isDeleted: false 
        },
        { 
          content: newContent,
          editedAt: new Date()
        },
        { new: true }
      );

      if (result) {
        console.log(`Message edited successfully`);
        return result;
      } else {
        console.log(`Message not found or not authorized to edit`);
        return null;
      }
    } catch (error) {
      console.error('Error editing message:', error);
      throw error;
    }
  }

  async deleteMessage(messageId, senderId, receiverId) {
    try {
      const ChatModel = this.getChatModel(senderId, receiverId);
      
      const message = await ChatModel.findById(messageId);
      
      if (!message) {
        return null;
      }
      
      if (message.senderId !== senderId.toString()) {
        return null;
      }
      
      const result = await ChatModel.findByIdAndDelete(messageId);

      if (result) {
      return result;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }
}

const chatManager = new ChatManager();

module.exports = {
  ChatManager,
  chatManager,
  chatsConnection
}; 