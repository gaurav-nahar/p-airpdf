import React, { useState, useEffect, useCallback, useRef } from "react";

//it is used to select a pdf file from the user's computer or from a URL
export default function PDFSelector({ onSelect }) {
  const [inputUrl, setInputUrl] = useState("");
  const [activeTab, setActiveTab] = useState("file"); // "file" or "url"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastAutoLoadedUrl = useRef(null);

  const loadPdfFromUrl = useCallback(async (url, preferredFileName = "") => {
    setError("");
    setLoading(true);
    setActiveTab("url");
    setInputUrl(url);

    // Abort previous request (if any)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 sec timeout

    try {
      /* ===============================
         Extract File Name Safely
      =============================== */

      let fileName = preferredFileName || "document.pdf";

      try {
        const parsedUrl = new URL(url);

        // Check path
        const pathParts = parsedUrl.pathname.split("/");
        const lastPart = pathParts[pathParts.length - 1];

        if (lastPart && lastPart.toLowerCase().endsWith(".pdf")) {
          fileName = decodeURIComponent(lastPart);
        } else {
          // Check query params
          const serveParam =
            parsedUrl.searchParams.get("serve") ||
            parsedUrl.searchParams.get("file") ||
            parsedUrl.searchParams.get("filename");

          if (serveParam && serveParam.toLowerCase().endsWith(".pdf")) {
            fileName = decodeURIComponent(serveParam);
          }
        }
      } catch {
        console.warn("[DEBUG] Filename parsing failed");
      }

      console.log("[DEBUG] Fetching PDF:", url);


      /* ===============================
         Fetch PDF as Blob
      =============================== */

      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server Error: ${response.status}`);
      }

      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("pdf")) {
        console.warn("Non-PDF Content-Type:", contentType);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("Received empty PDF file");
      }


      /* ===============================
         Create Temporary URL
      =============================== */

      const fileUrl = URL.createObjectURL(blob);

      console.log("[DEBUG] Blob URL:", fileUrl);


      /* ===============================
         Send to Viewer
      =============================== */

      await onSelect(fileUrl, fileName, url);

    } catch (err) {
      console.error("[PDF LOAD ERROR]", err);

      if (err.name === "AbortError") {
        setError("Request timeout. Please try again.");
      } else {
        setError(err.message || "Failed to load PDF");
      }

    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }

  }, [onSelect]);
  // Deep linking support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pdfUrl = params.get("pdf_url") || params.get("pdf"); // Support both pdf_url and pdf
    const pdfName = (params.get("pdf_name") || "").trim();
    if (pdfUrl && pdfUrl.startsWith("http")) {
      if (lastAutoLoadedUrl.current === pdfUrl) return;
      lastAutoLoadedUrl.current = pdfUrl;
      loadPdfFromUrl(pdfUrl, pdfName);
    }
  }, [loadPdfFromUrl]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      const fileUrl = URL.createObjectURL(file);
      onSelect(fileUrl, file.name, file.name);
    } else {
      alert("Please select a valid PDF file.");
    }
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (!inputUrl.trim()) {
      setError("Please enter a valid URL");
      return;
    }
    loadPdfFromUrl(inputUrl.trim());
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        background: "#f0f4ff",
        padding: "20px",
      }}
    >
    
    </div>
  );
}
