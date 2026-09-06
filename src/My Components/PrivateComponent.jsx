import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

export const PrivateComponent = () => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const verifyUser = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:5000/api/auth/verify",
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (response.ok) {
          setAuthenticated(true);
        } else {
          localStorage.removeItem("token");
          setAuthenticated(false);
        }

      } catch (error) {
        console.log("Authentication verification failed:", error);
        setAuthenticated(false);
      }

      setLoading(false);
    };

    verifyUser();
  }, []);

  if (loading) {
    return <div>Checking login...</div>;
  }

  return authenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateComponent;