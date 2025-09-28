"use client"

import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Rocket, 
  Target, 
  AlertTriangle, 
  Lightbulb, 
  Bot, 
  Globe, 
  MapPin, 
  Handshake, 
  Calendar, 
  Eye, 
  Users, 
  Github, 
  Mail, 
  Play,
  TrendingUp,
  Shield,
  Zap,
  Home,
  DollarSign,
  Camera
} from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-8">
              <Image
                src="/logo-minimal.png"
                alt="Nexus Reality Logo"
                width={120}
                height={120}
                className="h-24 w-24"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-4">
              About <span className="text-primary">Nexus Realty</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Your AI-powered connection to the perfect home, in any language.
            </p>
            <div className="flex justify-center">
              <Rocket className="h-8 w-8 text-primary" />
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardContent className="p-8 md:p-12">
              <div className="flex items-start space-x-4 mb-6">
                <Target className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">Our Mission</h2>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed">
                To revolutionize the real estate experience by replacing confusing searches with intelligent, 
                insightful conversations. We believe that finding a home should be an exciting and data-driven 
                journey, not a stressful chore. Nexus Realty is designed to be your personal real estate analyst, 
                providing clarity and confidence in one of life's biggest decisions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              The Problem with Real Estate Search
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              The traditional home-buying process is broken. Buyers are often overwhelmed by:
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: <TrendingUp className="h-6 w-6" />,
                title: "Information Overload",
                description: "Endless listings with no clear way to compare them meaningfully."
              },
              {
                icon: <Shield className="h-6 w-6" />,
                title: "Hidden Insights",
                description: "Critical data like investment potential and fair market value are hard to find."
              },
              {
                icon: <Globe className="h-6 w-6" />,
                title: "Language Barriers",
                description: "For non-native speakers, navigating listings and understanding local nuances is challenging."
              },
              {
                icon: <Calendar className="h-6 w-6" />,
                title: "Time-Consuming Process",
                description: "Scheduling viewings and getting simple questions answered can take days."
              }
            ].map((problem, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
                    {problem.icon}
                  </div>
                  <h3 className="font-semibold text-foreground">{problem.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{problem.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-4">
              <Lightbulb className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              The Solution: Meet Nexus Realty
            </h2>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
              Nexus Realty is an intelligent, multilingual chatbot that transforms the property search 
              from a manual task into a personalized conversation. By clicking on any property, users 
              can instantly activate their personal AI analyst to get deep, data-driven insights.
            </p>
          </div>
          
          <Card className="border-2 border-primary/20 shadow-xl">
            <CardContent className="p-8 md:p-12">
              <div className="text-center">
                <Bot className="h-16 w-16 text-primary mx-auto mb-6" />
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Our bot doesn't just answer questions—it provides proactive analysis, helping users 
                  understand the true value and potential of a property in seconds.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Key Features & Technology
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              We've packed Nexus Realty with powerful features to give you an unfair advantage in your home search:
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Bot className="h-6 w-6" />,
                title: "AI Personal Analyst",
                description: "Go beyond the listing. Get instant analysis on investment potential, rental yield, and a calculated 'Investment Score' for any property."
              },
              {
                icon: <Globe className="h-6 w-6" />,
                title: "Multilingual Support",
                description: "Chat naturally in your preferred language. Our bot seamlessly detects and translates conversations, making real estate accessible to everyone."
              },
              {
                icon: <MapPin className="h-6 w-6" />,
                title: "Deep Neighborhood Insights",
                description: "Ask 'What's it like to live here?' and get a summary of local reviews, lifestyle details, and commute times."
              },
              {
                icon: <Handshake className="h-6 w-6" />,
                title: "Negotiation Strategy",
                description: "Get AI-powered advice on what to offer, leveraging market data and property history to strengthen your position."
              },
              {
                icon: <Calendar className="h-6 w-6" />,
                title: "Automated Scheduling",
                description: "Found a place you love? The bot can check agent availability and schedule a virtual or in-person tour for you automatically."
              },
              {
                icon: <Eye className="h-6 w-6" />,
                title: "Virtual Tour Integration",
                description: "Instantly access 360° virtual tours directly within the chat for an immersive viewing experience."
              }
            ].map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-12">
            <Card className="border-2 border-primary/20">
              <CardContent className="p-8">
                <div className="text-center">
                  <Zap className="h-8 w-8 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-4">Technology Stack</h3>
                  <p className="text-muted-foreground mb-6">
                    Built with a modern, scalable stack including Next.js, Google Cloud AI (Translate & Language APIs), 
                    and a Vercel-powered deployment pipeline.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["Next.js", "Google Cloud AI", "Vercel", "TypeScript", "Tailwind CSS"].map((tech) => (
                      <Badge key={tech} variant="secondary" className="px-3 py-1">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">The Team</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Nexus Realty was brought to life during the HackathonName hackathon by a passionate team of builders:
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "YourName1", role: "AI & Backend Lead", link: "LinktoLinkedIn/GitHub" },
              { name: "YourName2", role: "Frontend & UX Developer", link: "LinktoLinkedIn/GitHub" },
              { name: "YourName3", role: "Product & Design", link: "LinktoLinkedIn/GitHub" }
            ].map((member, index) => (
              <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow">
                <div className="w-20 h-20 bg-primary/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{member.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{member.role}</p>
                <Button variant="outline" size="sm" className="w-full">
                  View Profile
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Hackathon Story Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <Card className="border-2 border-primary/20 shadow-lg">
            <CardContent className="p-8 md:p-12">
              <div className="text-center mb-8">
                <Rocket className="h-12 w-12 text-primary mx-auto mb-4" />
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Our Hackathon Story</h2>
              </div>
              <div className="prose prose-lg max-w-none text-muted-foreground">
                <p className="mb-6">
                  Our journey began with a shared frustration: the real estate market felt outdated. During this 48-hour sprint, 
                  our biggest challenge was creating a truly seamless multilingual experience that didn't feel robotic.
                </p>
                <p className="mb-6">
                  Our "aha!" moment came when we successfully implemented a hybrid system—combining a translation layer for user 
                  input with a robust internationalization framework for the bot's responses. This allowed our AI to maintain 
                  its analytical power while communicating naturally in any language.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Future Vision Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Eye className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Future Vision</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              This is just the beginning. Our roadmap for Nexus Realty includes:
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Users className="h-6 w-6" />,
                title: "Agent-Side Dashboard",
                description: "Allowing real estate agents to manage listings and track client interactions."
              },
              {
                icon: <DollarSign className="h-6 w-6" />,
                title: "Mortgage & Affordability Integration",
                description: "Connecting users with financial tools to understand their true budget."
              },
              {
                icon: <Camera className="h-6 w-6" />,
                title: "Image Recognition Search",
                description: "Allowing users to search for properties based on photos of homes they like."
              }
            ].map((vision, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                    {vision.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{vision.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{vision.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Get In Touch</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              We'd love to hear from you!
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <Github className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">GitHub Repository</h3>
              <p className="text-sm text-muted-foreground mb-4">Linktoyourproject'sGitHubrepo</p>
              <Button variant="outline" size="sm" className="w-full">
                View Code
              </Button>
            </Card>
            
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <Play className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Demo Video</h3>
              <p className="text-sm text-muted-foreground mb-4">LinktoashortYouTubedemo</p>
              <Button variant="outline" size="sm" className="w-full">
                Watch Demo
              </Button>
            </Card>
            
            <Card className="p-6 text-center hover:shadow-lg transition-shadow">
              <Mail className="h-8 w-8 text-primary mx-auto mb-4" />
              <h3 className="font-semibold text-foreground mb-2">Contact Us</h3>
              <p className="text-sm text-muted-foreground mb-4">Yourteam'semailaddress</p>
              <Button variant="outline" size="sm" className="w-full">
                Send Email
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Find Your Perfect Home?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Experience the future of real estate search with AI-powered insights.
          </p>
          <Button size="lg" variant="secondary" className="text-primary">
            Start Your Search
          </Button>
        </div>
      </section>
    </div>
  )
}
