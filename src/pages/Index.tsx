import { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const Index = () => {
  const [currentStep, setCurrentStep] = useState<"welcome" | "chat" | "form">("welcome");
  const [userQuestion, setUserQuestion] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userContact, setUserContact] = useState("");
  const [userAge, setUserAge] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [userId, setUserId] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const storedSessionId = localStorage.getItem("chatSessionId");
    if (storedSessionId) {
      setSessionId(storedSessionId);
      loadExistingSession(storedSessionId);
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      localStorage.setItem("chatSessionId", newSessionId);
      initializeSession(newSessionId);
    }
  }, []);

  const initializeSession = async (newSessionId: string) => {
    try {
      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          session_id: newSessionId,
          status: "active"
        })
        .select()
        .single();

      if (convError) throw convError;
      setConversationId(conversation.id);

      await supabase.from("user_behavior").insert({
        session_id: newSessionId,
        question_count: 0
      });
    } catch (error) {
      console.error("Error initializing session:", error);
    }
  };

  const loadExistingSession = async (existingSessionId: string) => {
    try {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("session_id", existingSessionId)
        .eq("status", "active")
        .maybeSingle();

      if (conversation) {
        setConversationId(conversation.id);
        if (conversation.user_id) {
          setUserId(conversation.user_id);
          const { data: userData } = await supabase
            .from("users")
            .select("*")
            .eq("id", conversation.user_id)
            .single();
          if (userData) {
            setUserName(userData.name);
            setUserEmail(userData.email);
            setUserContact(userData.contact);
            setUserAge(userData.age.toString());
          }
        }

        const { data: messages } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: true });

        if (messages && messages.length > 0) {
          const history = messages.map((msg) => ({
            role: msg.role as "user" | "assistant",
            content: msg.content,
            timestamp: new Date(msg.created_at)
          }));
          setConversationHistory(history);
          const userQuestions = messages.filter((msg) => msg.role === "user").length;
          setQuestionCount(userQuestions);
          if (userQuestions > 0 && userName) {
            setCurrentStep("chat");
          }
        }

        const { data: behavior } = await supabase
          .from("user_behavior")
          .select("*")
          .eq("session_id", existingSessionId)
          .maybeSingle();

        if (behavior) {
          setQuestionCount(behavior.question_count);
        }
      }
    } catch (error) {
      console.error("Error loading session:", error);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuestion.trim()) return;

    const newQuestionCount = questionCount + 1;

    const userMessage: Message = {
      role: "user",
      content: userQuestion.trim(),
      timestamp: new Date()
    };

    setConversationHistory((prev) => [...prev, userMessage]);

    if (conversationId) {
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userQuestion.trim()
      });
    }

    if (newQuestionCount <= 2) {
      setQuestionCount(newQuestionCount);
      await getAIResponse(userQuestion.trim(), conversationHistory);
      setUserQuestion("");
      setCurrentStep("chat");

      await supabase
        .from("user_behavior")
        .update({ question_count: newQuestionCount })
        .eq("session_id", sessionId);
    } else {
      setPendingQuestion(userQuestion.trim());
      setUserQuestion("");
      setCurrentStep("form");
    }
  };

  const getAIResponse = async (question: string, history: Message[]) => {
    setIsTyping(true);
    try {
      const { data, error } = await supabase.functions.invoke("chat-with-gemini", {
        body: {
          question,
          userName: userName || null,
          conversationHistory: history,
          sessionId
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: "assistant",
        content: data.answer,
        timestamp: new Date()
      };

      setConversationHistory((prev) => [...prev, assistantMessage]);

      if (conversationId) {
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: data.answer
        });

        await supabase
          .from("conversations")
          .update({ last_activity: new Date().toISOString() })
          .eq("id", conversationId);
      }

      if (data.topics && data.topics.length > 0) {
        await supabase
          .from("user_behavior")
          .update({
            topics: data.topics,
            interests: { lastQuestion: question, timestamp: new Date().toISOString() }
          })
          .eq("session_id", sessionId);
      }

      extractSuggestedQuestions(data.answer);
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const extractSuggestedQuestions = (response: string) => {
    const lines = response.split("\n");
    const questions: string[] = [];
    let inQuestionSection = false;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (
        trimmedLine.toLowerCase().includes("follow-up") ||
        trimmedLine.toLowerCase().includes("related questions") ||
        trimmedLine.toLowerCase().includes("you might also")
      ) {
        inQuestionSection = true;
      } else if (inQuestionSection && /^\d+\./.test(trimmedLine)) {
        const questionText = trimmedLine.replace(/^\d+\.\s*/, "").replace(/\?$/, "");
        if (questionText.length > 10) {
          questions.push(questionText);
        }
      }
    });

    if (questions.length > 0) {
      setSuggestedQuestions(questions.slice(0, 3));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName || !userEmail || !userContact || !userAge) return;

    try {
      const { data: newUser, error: userError } = await supabase
        .from("users")
        .insert({
          name: userName,
          email: userEmail,
          contact: userContact,
          age: parseInt(userAge)
        })
        .select()
        .single();

      if (userError) throw userError;

      setUserId(newUser.id);
      setQuestionCount(questionCount + 1);

      await supabase
        .from("conversations")
        .update({ user_id: newUser.id })
        .eq("id", conversationId);

      await supabase
        .from("user_behavior")
        .update({ user_id: newUser.id, question_count: questionCount + 1 })
        .eq("session_id", sessionId);

      if (pendingQuestion) {
        await getAIResponse(pendingQuestion, conversationHistory);
        setPendingQuestion("");
      }

      setCurrentStep("chat");
    } catch (error) {
      console.error("Error saving user data:", error);
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setUserQuestion(question);
  };

  const handleNewConversation = () => {
    setConversationHistory([]);
    setQuestionCount(0);
    setUserQuestion("");
    setPendingQuestion("");
    setSuggestedQuestions([]);
    setUserName("");
    setUserEmail("");
    setUserContact("");
    setUserAge("");
    setCurrentStep("welcome");
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    localStorage.setItem("chatSessionId", newSessionId);
    initializeSession(newSessionId);
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
            {currentStep === "welcome" && (
              <div className="text-center" style={{ animation: "fadeIn 0.6s ease-out" }}>
                <div className="mb-4" style={{ fontSize: "4rem", animation: "bounce 2s infinite" }}>
                  🤖
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
                  Hey there! Ask me anything.
                </h1>

                <p className="mb-5" style={{ fontSize: "1.2rem", color: "hsl(280, 10%, 40%)" }}>
                  I'm iSource AI Answer Chat Bot, here to help with accurate answers!
                </p>

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
                  >
                    Ask Me
                  </button>
                </form>
              </div>
            )}

            {currentStep === "chat" && (
              <div style={{ animation: "fadeIn 0.6s ease-out" }}>
                <div
                  className="card border-0 mb-4"
                  style={{
                    borderRadius: "2rem",
                    padding: "2rem",
                    background: "white",
                    boxShadow: "0 20px 60px -10px rgba(0,0,0,0.1)",
                    maxHeight: "60vh",
                    overflowY: "auto"
                  }}
                >
                  <h3 className="mb-4" style={{ color: "hsl(280, 10%, 20%)", fontWeight: "700" }}>
                    Conversation
                  </h3>

                  {conversationHistory.map((msg, index) => (
                    <div
                      key={index}
                      className={`mb-3 ${msg.role === "assistant" ? "text-start" : "text-end"}`}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          maxWidth: "80%",
                          padding: "1rem 1.5rem",
                          borderRadius: "1.5rem",
                          background:
                            msg.role === "assistant"
                              ? "linear-gradient(135deg, hsl(280, 60%, 97%), hsl(340, 70%, 97%))"
                              : "linear-gradient(135deg, hsl(280, 60%, 70%), hsl(340, 70%, 75%))",
                          color: msg.role === "assistant" ? "hsl(280, 10%, 20%)" : "white",
                          whiteSpace: "pre-line",
                          textAlign: "left",
                          wordWrap: "break-word"
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="text-start mb-3">
                      <div
                        style={{
                          display: "inline-block",
                          padding: "1rem 1.5rem",
                          borderRadius: "1.5rem",
                          background: "linear-gradient(135deg, hsl(280, 60%, 97%), hsl(340, 70%, 97%))"
                        }}
                      >
                        <span className="spinner-grow spinner-grow-sm me-2" style={{ width: "0.5rem", height: "0.5rem" }}></span>
                        <span className="spinner-grow spinner-grow-sm me-2" style={{ width: "0.5rem", height: "0.5rem" }}></span>
                        <span className="spinner-grow spinner-grow-sm" style={{ width: "0.5rem", height: "0.5rem" }}></span>
                      </div>
                    </div>
                  )}
                </div>

                {suggestedQuestions.length > 0 && !isTyping && (
                  <div className="card border-0 mb-4" style={{ borderRadius: "1.5rem", padding: "1.5rem", background: "white" }}>
                    <h6 style={{ color: "hsl(280, 10%, 40%)", marginBottom: "1rem" }}>
                      Related questions you might ask:
                    </h6>
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        className="btn btn-sm mb-2 w-100 text-start"
                        onClick={() => handleSuggestedQuestion(q)}
                        style={{
                          background: "hsl(280, 30%, 95%)",
                          border: "1px solid hsl(280, 30%, 90%)",
                          borderRadius: "1rem",
                          padding: "0.8rem 1rem",
                          color: "hsl(280, 10%, 30%)",
                          transition: "all 0.3s ease"
                        }}
                      >
                        {q}?
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAskQuestion}>
                  <div className="input-group" style={{ boxShadow: "0 10px 40px -10px rgba(0,0,0,0.1)" }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ask another question..."
                      value={userQuestion}
                      onChange={(e) => setUserQuestion(e.target.value)}
                      required
                      disabled={isTyping}
                      style={{
                        borderRadius: "2rem 0 0 2rem",
                        border: "2px solid hsl(280, 30%, 90%)",
                        padding: "1rem 1.5rem",
                        fontSize: "1rem"
                      }}
                    />
                    <button
                      type="submit"
                      className="btn"
                      disabled={isTyping}
                      style={{
                        background: "linear-gradient(135deg, hsl(280, 60%, 70%), hsl(340, 70%, 75%))",
                        border: "none",
                        borderRadius: "0 2rem 2rem 0",
                        color: "white",
                        padding: "0 2rem",
                        fontWeight: "600"
                      }}
                    >
                      Send
                    </button>
                  </div>
                </form>

                <div className="text-center mt-3">
                  <button
                    onClick={handleNewConversation}
                    className="btn btn-sm"
                    style={{
                      background: "transparent",
                      border: "1px solid hsl(280, 30%, 80%)",
                      borderRadius: "1rem",
                      color: "hsl(280, 10%, 40%)",
                      padding: "0.5rem 1.5rem"
                    }}
                  >
                    Start New Conversation
                  </button>
                </div>
              </div>
            )}

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
                    Just before I answer, tell me a bit about you
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
                    >
                      Submit & Get Answer
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

        .form-control:focus {
          border-color: hsl(280, 60%, 70%) !important;
          box-shadow: 0 0 0 0.2rem hsl(280, 60%, 70%, 0.25) !important;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 40px -5px hsl(280, 60%, 70%, 0.5) !important;
        }
      `}</style>
    </div>
  );
};

export default Index;
