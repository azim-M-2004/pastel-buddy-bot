import { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  // State management for multi-step flow
  const [currentStep, setCurrentStep] = useState<"welcome" | "form" | "response">("welcome");
  const [userQuestion, setUserQuestion] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userContact, setUserContact] = useState("");
  const [userAge, setUserAge] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  // Handle question submission
  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (userQuestion.trim()) {
      setCurrentStep("form");
    }
  };

  const [aiResponse, setAiResponse] = useState("");
  const { toast } = useToast();

  // Handle form submission and call Gemini API
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userName && userEmail && userContact && userAge) {
      setCurrentStep("response");
      setIsTyping(true);
      
      try {
        const { data, error } = await supabase.functions.invoke('chat-with-gemini', {
          body: { question: userQuestion, userName }
        });

        if (error) throw error;

        setAiResponse(data.answer);
        setShowResponse(true);
      } catch (error) {
        console.error('Error calling Gemini API:', error);
        toast({
          title: "Error",
          description: "Failed to get response from AI. Please try again.",
          variant: "destructive",
        });
        setCurrentStep("form");
      } finally {
        setIsTyping(false);
      }
    }
  };

  // Generate AI response display
  const generateResponse = () => {
    return `Hey ${userName}! Thanks for sharing 💐\n\n${aiResponse}\n\nIf you need any more help, I'm always here for you! 💕`;
  };

  return (
    <div 
      className="min-vh-100 d-flex align-items-center justify-content-center p-3"
      style={{
        background: "linear-gradient(135deg, hsl(280, 60%, 95%), hsl(20, 80%, 95%))",
        transition: "all 0.4s ease"
      }}
    >
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            
            {/* SECTION 1: WELCOME / CHAT INPUT */}
            {currentStep === "welcome" && (
              <div 
                className="text-center"
                style={{
                  animation: "fadeIn 0.6s ease-out"
                }}
              >
                {/* Lovable AI Logo/Emoji */}
                <div 
                  className="mb-4"
                  style={{
                    fontSize: "4rem",
                    animation: "bounce 2s infinite"
                  }}
                >
                  🤖💕
                </div>
                
                <h1 
                  className="mb-3"
                  style={{
                    fontSize: "clamp(2rem, 5vw, 3rem)",
                    fontWeight: "700",
                    color: "hsl(280, 10%, 20%)",
                    textShadow: "0 2px 10px rgba(0,0,0,0.05)"
                  }}
                >
                  Hey there 👋! Ask me anything.
                </h1>
                
                <p 
                  className="mb-5"
                  style={{
                    fontSize: "1.2rem",
                    color: "hsl(280, 10%, 40%)"
                  }}
                >
                  I'm iSource AI Answer Chat Bot, here to help with accurate answers! 💖
                </p>

                {/* Question Input Form */}
                <form onSubmit={handleAskQuestion}>
                  <div className="mb-4">
                    <input
                      type="text"
                      className="form-control form-control-lg"
                      placeholder="Type your question here..."
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      required
                      style={{
                        borderRadius: "2rem",
                        border: "2px solid hsl(280, 30%, 90%)",
                        padding: "1.2rem 2rem",
                        fontSize: "1.1rem",
                        boxShadow: "0 10px 40px -10px hsl(280, 60%, 70%, 0.2)",
                        transition: "all 0.3s ease"
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "hsl(280, 60%, 70%)";
                        e.target.style.boxShadow = "0 0 30px hsl(280, 60%, 70%, 0.3)";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "hsl(280, 30%, 90%)";
                        e.target.style.boxShadow = "0 10px 40px -10px hsl(280, 60%, 70%, 0.2)";
                      }}
                    />
                  </div>
                  
                  <button
                    type="submit"
                    className="btn btn-lg px-5 py-3"
                    style={{
                      background: "linear-gradient(135deg, hsl(280, 60%, 70%), hsl(340, 70%, 75%))",
                      border: "none",
                      borderRadius: "2rem",
                      color: "white",
                      fontSize: "1.2rem",
                      fontWeight: "600",
                      boxShadow: "0 10px 30px -5px hsl(280, 60%, 70%, 0.4)",
                      transition: "all 0.3s ease",
                      textShadow: "0 1px 2px rgba(0,0,0,0.1)"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 15px 40px -5px hsl(280, 60%, 70%, 0.5)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 10px 30px -5px hsl(280, 60%, 70%, 0.4)";
                    }}
                  >
                    Ask Me 💬
                  </button>
                </form>
              </div>
            )}

            {/* SECTION 2: LEAD FORM */}
            {currentStep === "form" && (
              <div
                className="card border-0"
                style={{
                  borderRadius: "2rem",
                  padding: "2.5rem",
                  boxShadow: "0 20px 60px -10px rgba(0,0,0,0.1)",
                  background: "white",
                  animation: "fadeIn 0.6s ease-out"
                }}
              >
                <div className="card-body">
                  <h2 
                    className="text-center mb-2"
                    style={{
                      color: "hsl(280, 10%, 20%)",
                      fontWeight: "700",
                      fontSize: "clamp(1.5rem, 4vw, 2rem)"
                    }}
                  >
                    Just before I answer, tell me a bit about you 💕
                  </h2>
                  
                  <p 
                    className="text-center mb-4"
                    style={{
                      color: "hsl(280, 10%, 50%)",
                      fontSize: "1.1rem"
                    }}
                  >
                    I'd love to personalize my response just for you!
                  </p>

                  <form onSubmit={handleFormSubmit}>
                    {/* Full Name */}
                    <div className="mb-3">
                      <label className="form-label" style={{ fontWeight: "600", color: "hsl(280, 10%, 30%)" }}>
                        Full Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter your lovely name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        required
                        style={{
                          borderRadius: "1rem",
                          border: "2px solid hsl(280, 30%, 90%)",
                          padding: "0.8rem 1.2rem"
                        }}
                      />
                    </div>

                    {/* Email */}
                    <div className="mb-3">
                      <label className="form-label" style={{ fontWeight: "600", color: "hsl(280, 10%, 30%)" }}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="your.email@example.com"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        required
                        style={{
                          borderRadius: "1rem",
                          border: "2px solid hsl(280, 30%, 90%)",
                          padding: "0.8rem 1.2rem"
                        }}
                      />
                    </div>

                    {/* Contact Number */}
                    <div className="mb-3">
                      <label className="form-label" style={{ fontWeight: "600", color: "hsl(280, 10%, 30%)" }}>
                        Contact Number
                      </label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="+1 (555) 123-4567"
                        value={userContact}
                        onChange={(e) => setUserContact(e.target.value)}
                        required
                        style={{
                          borderRadius: "1rem",
                          border: "2px solid hsl(280, 30%, 90%)",
                          padding: "0.8rem 1.2rem"
                        }}
                      />
                    </div>

                    {/* Age */}
                    <div className="mb-4">
                      <label className="form-label" style={{ fontWeight: "600", color: "hsl(280, 10%, 30%)" }}>
                        Age
                      </label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="Your age"
                        value={userAge}
                        onChange={(e) => setUserAge(e.target.value)}
                        required
                        min="1"
                        max="120"
                        style={{
                          borderRadius: "1rem",
                          border: "2px solid hsl(280, 30%, 90%)",
                          padding: "0.8rem 1.2rem"
                        }}
                      />
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      className="btn w-100 py-3"
                      style={{
                        background: "linear-gradient(135deg, hsl(280, 60%, 70%), hsl(340, 70%, 75%))",
                        border: "none",
                        borderRadius: "1rem",
                        color: "white",
                        fontSize: "1.1rem",
                        fontWeight: "600",
                        boxShadow: "0 10px 30px -5px hsl(280, 60%, 70%, 0.4)",
                        transition: "all 0.3s ease"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 15px 40px -5px hsl(280, 60%, 70%, 0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 10px 30px -5px hsl(280, 60%, 70%, 0.4)";
                      }}
                    >
                      Submit & Continue 💖
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* SECTION 3: CHATBOT RESPONSE */}
            {currentStep === "response" && (
              <div
                style={{
                  animation: "fadeIn 0.6s ease-out"
                }}
              >
                {/* Chat bubble with AI response */}
                <div
                  className="card border-0"
                  style={{
                    borderRadius: "2rem",
                    padding: "2rem",
                    background: "white",
                    boxShadow: "0 20px 60px -10px rgba(0,0,0,0.1)",
                    maxWidth: "700px",
                    margin: "0 auto"
                  }}
                >
                  {/* AI Avatar */}
                  <div className="d-flex align-items-start mb-3">
                    <div
                      className="me-3"
                      style={{
                        fontSize: "3rem"
                      }}
                    >
                      🤖💕
                    </div>
                    <div className="flex-grow-1">
                      <h5 
                        style={{
                          color: "hsl(280, 60%, 70%)",
                          fontWeight: "700",
                          marginBottom: "0.5rem"
                        }}
                      >
                        iSource AI Answer Chat Bot
                      </h5>
                      <small style={{ color: "hsl(280, 10%, 50%)" }}>
                        Just now
                      </small>
                    </div>
                  </div>

                  {/* Typing indicator or response */}
                  {isTyping ? (
                    <div className="d-flex align-items-center">
                      <div 
                        className="spinner-grow spinner-grow-sm me-2"
                        style={{ color: "hsl(280, 60%, 70%)" }}
                        role="status"
                      >
                        <span className="visually-hidden">Typing...</span>
                      </div>
                      <div 
                        className="spinner-grow spinner-grow-sm me-2"
                        style={{ color: "hsl(340, 70%, 75%)", animationDelay: "0.1s" }}
                        role="status"
                      >
                        <span className="visually-hidden">Typing...</span>
                      </div>
                      <div 
                        className="spinner-grow spinner-grow-sm"
                        style={{ color: "hsl(20, 80%, 75%)", animationDelay: "0.2s" }}
                        role="status"
                      >
                        <span className="visually-hidden">Typing...</span>
                      </div>
                      <span 
                        className="ms-2"
                        style={{ 
                          color: "hsl(280, 10%, 50%)",
                          fontSize: "0.95rem"
                        }}
                      >
                        Typing...
                      </span>
                    </div>
                  ) : showResponse && (
                    <div
                      style={{
                        animation: "fadeIn 0.5s ease-out"
                      }}
                    >
                      <div
                        style={{
                          background: "linear-gradient(135deg, hsl(280, 60%, 97%), hsl(340, 70%, 97%))",
                          borderRadius: "1.5rem",
                          padding: "1.5rem",
                          whiteSpace: "pre-line",
                          lineHeight: "1.8",
                          color: "hsl(280, 10%, 20%)",
                          fontSize: "1.05rem"
                        }}
                      >
                        {generateResponse()}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-4 d-flex gap-2 flex-wrap justify-content-center">
                        <button
                          className="btn"
                          onClick={() => {
                            setCurrentStep("welcome");
                            setUserQuestion("");
                            setUserName("");
                            setUserEmail("");
                            setUserContact("");
                            setUserAge("");
                            setShowResponse(false);
                          }}
                          style={{
                            background: "linear-gradient(135deg, hsl(280, 60%, 70%), hsl(340, 70%, 75%))",
                            border: "none",
                            borderRadius: "1rem",
                            color: "white",
                            padding: "0.7rem 1.5rem",
                            fontWeight: "600",
                            transition: "all 0.3s ease"
                          }}
                        >
                          Ask Another Question 🌟
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Custom CSS animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        /* Smooth focus states for inputs */
        .form-control:focus {
          border-color: hsl(280, 60%, 70%) !important;
          box-shadow: 0 0 0 0.2rem hsl(280, 60%, 70%, 0.25) !important;
        }
      `}</style>
    </div>
  );
};

export default Index;
