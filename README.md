# 📸 Pixgram – Social Media Web App

Welcome to **Pixgram**! This modern full-stack web application empowers users to share posts, join groups, chat in real time, and connect with friends—all through a beautiful, intuitive interface. Built with robust web technologies and best practices, Pixgram delivers a seamless and engaging social experience.

---

## 🏗️ Architecture & Patterns

- **MVC Architecture:** Clean separation of concerns with controllers, models, and routes for maintainability and scalability.
- **RESTful API:** Secure, well-structured endpoints for all core features.
- **JWT Authentication:** Secure user sessions and protected routes.
- **Socket.io:** Real-time messaging and notifications for instant communication.

---

## 🌐 Backend & Data

- **Node.js & Express:** Fast, scalable server-side logic.
- **MongoDB & Mongoose:** Flexible, schema-based NoSQL database for users, posts, groups, and messages.
- **Controllers:** All business logic is handled in dedicated controller files for clarity and testability.
- **File Uploads:** Media (images, videos, profile pictures) are handled with Multer and stored on the server.

---

## ✨ Features

- **Socket.io Integration:** Enables real-time chat between users and instant notifications.
- **User Authentication:** Register, login, and secure session management.
- **Profile Management:** Edit bio, upload profile pictures, and view user stats.
- **Friends System:** Send, accept, and reject friend requests; view friends and followers.
- **Groups:** Create, join, and manage groups; group membership approval and requests.
- **Group Posts:** Share posts within groups, with privacy controls.
- **Feed:** Personalized feed showing posts from friends and groups you belong to.
- **Media Uploads:** Share images and videos in posts and groups.
- **Comments & Likes:** Engage with posts through comments and likes.
- **Responsive UI:** Modern, mobile-friendly interface built with React.js and CSS3.

---

## 🛠️ Key Technologies & Libraries

| Technology/Library | Purpose                                 |
|--------------------|-----------------------------------------|
| React.js           | Modern, component-based frontend        |
| Node.js, Express   | Backend server and REST API             |
| MongoDB, Mongoose  | Database and schema modeling            |
| Socket.io          | Real-time chat and notifications        |
| JWT                | Authentication and session management   |
| Multer             | File uploads (images, videos)           |
| Axios              | HTTP requests from frontend             |
| CSS3               | Responsive, modern UI                   |

---

## 🚀 Getting Started

1. **Clone the repository**
2. **Install dependencies**  
   - In `/server` and `/client`: `npm install`
3. **Set up environment variables**  
   - Add your MongoDB URI and JWT secret to `/server/.env`
4. **Run the backend**  
   - `cd server && npm start`
5. **Run the frontend**  
   - `cd ../client && npm start`
6. **Access the app**  
   - Open (http://localhost:3000) in your browser

---

## 👩‍💻 Developers

- Segev Cohen
- Sean Mashiah

---

## 🏆 Project Highlights

- **Full-stack architecture:** Modern React frontend and Node.js/Express backend.
- **Real-time chat:** Instant messaging with Socket.io.
- **Clean, scalable codebase:** MVC pattern, controllers, and modular design.
- **Production-ready features:** Authentication, media uploads, and robust error handling.
- **Beautiful UI/UX:** Responsive layouts, smooth navigation, and modern design.

---

## 📄 License

This project is for demonstration and educational purposes. 
