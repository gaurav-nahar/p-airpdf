import { useEffect, useRef } from "react";

export default function useLocalStorageSync(
  snippets,
  connections,
  editableBoxes,
  lines,
  pdfLines
) {
  const timeoutRef = useRef(null);

  // ✅ Throttled save to localStorage
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      localStorage.setItem("snippets", JSON.stringify(snippets));
      localStorage.setItem("connections", JSON.stringify(connections));
      localStorage.setItem("editable_boxes", JSON.stringify(editableBoxes));
      localStorage.setItem("drawn_lines", JSON.stringify(lines));
      localStorage.setItem("pdf_lines", JSON.stringify(pdfLines));

    }, 1000); // Wait 1 second after last change to save

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [snippets, connections, editableBoxes, lines, pdfLines]);
}

