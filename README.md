Secure Software System Assignment

Group No. 4

- Wong Ki Hurn,
- Ong Ding Zhang,
- Elvina Laurencia Ryanto,
- Chellsea Vanesya Ong,
- Yu Watanabe


# SecureFin

A secure personal finance management web application built with React and Express.

## Features

- User Authentication & Authorization
- Secure Password Storage
- Transaction Management
- Financial Insights
- AI-powered Financial Recommendations

## Tech Stack

### Frontend
- **React**: UI library for building the user interface
- **TypeScript**: Type safety for JavaScript
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library
- **React Router**: Client-side routing

### Backend
- **Express**: Node.js web framework
- **TypeScript**: Type safety for JavaScript
- **Google GenAI**: AI-powered features
- **JWT**: Authentication
- **Bcrypt**: Password hashing

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/SecureFin.git
   cd SecureFin
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Backend
   GEMINI_API_KEY=your_gemini_api_key
   PORT=3000

   # Database (optional for now, can be added later)
   DATABASE_URL=your_database_url
   ```

4. **Run the application**
   ```bash
   npm run dev
   ```

## Project Structure

```
SecureFin/
├── src/                  # Source code
│   ├── components/       # React components
│   ├── pages/            # Page components
│   ├── services/         # API services
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── server.js           # Express backend server
├── vite.config.ts        # Vite frontend configuration
└── tsconfig.json         # TypeScript configuration
```

## AI Features

This application includes AI-powered financial insights and recommendations powered by Google's GenAI.

## License

MIT

## Contact

- [Your Name](mailto:[EMAIL_ADDRESS])
