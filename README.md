# Nexus Realty 🤖🏠

**Your AI-powered connection to the perfect home, in any language.**

A brief demo showing the multilingual chatbot in action.

## 🚀 The Problem

The traditional real estate search is broken. Users face information overload, language barriers, and a lack of deep, actionable insights. Critical data like investment potential, neighborhood quality, and fair market value are buried, making one of life's biggest decisions unnecessarily stressful.

## ✨ The Solution: Nexus Realty

Nexus Realty is an intelligent, multilingual chatbot that transforms the property search from a manual chore into a personalized conversation. By clicking on any property, users can instantly activate a personal AI analyst to get deep, data-driven insights, ask complex questions in their native language, and even get AI-powered negotiation advice.

[➡️ View Live Demo](#getting-started)

## 🛠️ Key Features

- **🤖 AI Personal Analyst**: Go beyond the listing. Get instant analysis on investment potential, rental yield, and a calculated "Investment Score."
- **🌍 Multilingual Support**: Chat naturally in your preferred language. Our bot seamlessly detects and translates conversations, making real estate accessible to everyone.
- **🏘️ Deep Neighborhood Insights**: Ask "What's it like to live here?" and get a summary of local reviews, lifestyle details, and commute times.
- **🤝 AI Negotiation Strategy**: Get expert advice on what to offer, leveraging market data and property history to strengthen your position.
- **🗓️ Automated Scheduling**: Found a place you love? The bot can check agent availability and schedule a virtual or in-person tour for you automatically.
- **👀 Virtual Tour Integration**: Instantly access 360° virtual tours directly within the chat for an immersive viewing experience.

## ⚙️ How It Works: The Tech Stack

Nexus Realty is built on a modern, scalable architecture designed for a seamless AI experience.

### Frontend
- **Next.js 14** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** components for accessibility

### Backend
- **Next.js API Routes** for serverless functions
- **Google Cloud AI** for language processing
- **Sensay API** for core AI functionality

### AI & Language
- **Core Logic**: Google Cloud AI / Large Language Models
- **Language Detection**: Google Cloud Translation API with fallback patterns
- **Translation**: Google Cloud Translation API (@google-cloud/translate)

### Deployment
- **Vercel** for hosting and deployment

## 🔄 Architectural Flow

1. **User Input**: A user sends a message in any language from the Next.js frontend.
2. **Language Detection**: The API route first detects the user's language using Google Cloud Translation API with pattern matching fallbacks.
3. **Input Translation**: The user's message is translated into English using the Google Translate API.
4. **Core AI Processing**: The translated (English) message is sent to our core LLM, which uses a sophisticated JSON-only system prompt to understand intent and extract entities.
5. **Action Handling**: The backend receives a JSON object with an action (e.g., search, calculate_yield, negotiate) and executes the corresponding logic—making API calls or triggering specialized AI agents.
6. **Output Translation**: The final English response content is translated back to the user's detected language.
7. **Display**: The frontend displays the translated, context-aware response.

## 🚀 Getting Started: Running Locally

Follow these instructions to set up and run the project on your local machine.

### Prerequisites

- Node.js (v18 or later)
- npm, yarn, or pnpm
- Google Cloud Account with the Translation API enabled

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/nexus-realty.git
cd nexus-realty
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Set Up Environment Variables

You will need to set up credentials for the Google Cloud Translation API.

1. Follow the [Google Cloud setup guide](https://cloud.google.com/translate/docs/setup) to create a service account and download the JSON key file.
2. Place the downloaded key file (e.g., `gcloud-credentials.json`) in the root of the project.
3. Create a `.env.local` file in the root of the project:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your credentials:

```env
# .env.local

# Path to your Google Cloud service account key file
GOOGLE_APPLICATION_CREDENTIALS="./gcloud-credentials.json"

# Add any other API keys you might need (e.g., for a Real Estate Data API)
# REAL_ESTATE_API_KEY="your_api_key_here"
```

> **Important**: Your credentials file is listed in `.gitignore` and should never be committed to source control.

### 4. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📁 Project Structure

```
nexus-realty/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── chat/          # Main chat API
│   │   ├── translate/     # Translation API
│   │   ├── neighborhood/  # Neighborhood data API
│   │   └── realtor/       # Real estate data API
│   ├── [id]/              # Dynamic property pages
│   ├── about/             # About page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── chatbot-dialog.tsx # Main chatbot component
│   ├── map-and-results.tsx # Property map and results
│   └── property-card.tsx  # Property display cards
├── lib/                   # Utility functions
├── types/                 # TypeScript type definitions
└── public/               # Static assets
```

## 🌍 Supported Languages

The application supports 100+ languages including:

- **European**: English, Spanish, French, German, Italian, Portuguese, Russian, Polish, Dutch, Swedish, Danish, Norwegian, Finnish, Czech, Hungarian, Romanian, Bulgarian, Croatian, Slovak, Slovenian, Estonian, Latvian, Lithuanian, Greek, Welsh, Catalan, Galician, Icelandic, Irish, Macedonian, Maltese, Basque, Albanian, Belarusian, Bosnian, Esperanto, Luxembourgish
- **Asian**: Chinese (Simplified & Traditional), Japanese, Korean, Hindi, Thai, Vietnamese, Turkish, Arabic, Persian, Urdu, Bengali, Tamil, Telugu, Malayalam, Kannada, Gujarati, Punjabi, Marathi, Nepali, Sinhala, Burmese, Khmer, Lao, Georgian, Amharic, Kazakh, Kyrgyz, Mongolian, Tajik, Uzbek, Ukrainian, Hebrew, Yiddish
- **African**: Swahili, Zulu, Xhosa, Yoruba, Igbo, Chichewa, Shona, Somali, Sundanese, Malagasy, Hausa, Amharic
- **Other**: Indonesian, Malay, Filipino, Hawaiian, Haitian Creole, Hmong, Javanese, Samoan, Pashto, and many more

## 🔧 API Endpoints

### Chat API (`/api/chat`)
- **POST**: Main chat endpoint for AI conversations
- Handles multilingual input/output
- Processes property analysis requests
- Manages conversation context

### Translation API (`/api/translate`)
- **POST**: Translates text between languages
- Auto-detects source language
- Uses Google Cloud Translation API

### Neighborhood API (`/api/neighborhood`)
- **POST**: Fetches neighborhood data
- Returns schools, parks, cafes, and transit information
- Uses coordinates for location-based search

### Realtor API (`/api/realtor`)
- **GET**: Fetches property details
- **POST**: Searches for properties
- Integrates with real estate data sources

## 🎨 Design System

The application uses a modern design system built with:

- **Tailwind CSS** for utility-first styling
- **Radix UI** for accessible component primitives
- **Lucide React** for consistent iconography
- **Geist** font family for typography
- **Custom color palette** optimized for real estate data visualization

## 🚀 Deployment

The application is optimized for deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Set up environment variables in Vercel dashboard
3. Deploy automatically on every push to main branch

## 👨‍💻 The Team

Nexus Realty was built by a passionate team during the [Hackathon Name].

- **[Your Name 1]** - AI & Backend Lead - [GitHub](https://github.com/username1) | [LinkedIn](https://linkedin.com/in/username1)
- **[Your Name 2]** - Frontend & UX Developer - [GitHub](https://github.com/username2) | [LinkedIn](https://linkedin.com/in/username2)
- **[Your Name 3]** - Product & Design - [GitHub](https://github.com/username3) | [LinkedIn](https://linkedin.com/in/username3)

## 🔭 Future Vision

- **Agent-Side Dashboard**: A portal for agents to manage listings and track client interactions
- **Mortgage & Affordability Integration**: Connecting users with financial tools to understand their true budget
- **Image Recognition Search**: Allowing users to search for properties based on photos ("Find me homes with a kitchen like this")
- **Advanced Analytics**: Machine learning models for market trend prediction
- **Mobile App**: Native iOS and Android applications
- **Voice Interface**: Voice-activated property search and analysis

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Google Cloud Translation API for multilingual support
- Sensay API for AI conversation capabilities
- Vercel for hosting and deployment
- The open-source community for the amazing tools and libraries

---

**Built with ❤️ for the future of real estate**