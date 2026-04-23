import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    $getSelection,
    $isRangeSelection,
    $isRootOrShadowRoot,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    COMMAND_PRIORITY_LOW,
    FORMAT_ELEMENT_COMMAND,
    FORMAT_TEXT_COMMAND,
    REDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    UNDO_COMMAND,
} from "lexical";
import {
    $createHeadingNode,
    $createQuoteNode,
    $isHeadingNode,
    HeadingNode,
    QuoteNode,
} from "@lexical/rich-text";
import {
    $createCodeNode,
    $isCodeNode,
    CodeHighlightNode,
    CodeNode,
} from "@lexical/code";
import {
    $isListNode,
    INSERT_ORDERED_LIST_COMMAND,
    INSERT_UNORDERED_LIST_COMMAND,
    ListItemNode,
    ListNode,
    REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { $isLinkNode, AutoLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
    $getSelectionStyleValueForProperty,
    $patchStyleText,
    $setBlocksType,
} from "@lexical/selection";
import { TRANSFORMERS } from "@lexical/markdown";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";

const FONT_FAMILIES = [
    { label: "Arial", value: "Arial, sans-serif" },
    { label: "Georgia", value: "Georgia, serif" },
    { label: "Verdana", value: "Verdana, sans-serif" },
    { label: "Courier New", value: "\"Courier New\", monospace" },
];

const FONT_SIZES = ["12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px"];
const SPEECH_LANGUAGES = [
    { label: "English", value: "en-US" },
    { label: "English (India)", value: "en-IN" },
        { label: "Hindi", value: "hi-IN" },

  { label: "Bengali", value: "bn-IN" },
  { label: "Gujarati", value: "gu-IN" },
  { label: "Kannada", value: "kn-IN" },
  { label: "Malayalam", value: "ml-IN" },
  { label: "Marathi", value: "mr-IN" },
  { label: "Punjabi", value: "pa-IN" },
  { label: "Tamil", value: "ta-IN" },
  { label: "Telugu", value: "te-IN" },
  { label: "Urdu", value: "ur-IN" },
];

const editorTheme = {
    paragraph: "documentation-editor-paragraph",
    quote: "documentation-editor-quote",
    heading: {
        h1: "documentation-editor-h1",
        h2: "documentation-editor-h2",
        h3: "documentation-editor-h3",
    },
    list: {
        ul: "documentation-editor-ul",
        ol: "documentation-editor-ol",
        listitem: "documentation-editor-li",
    },
    text: {
        bold: "documentation-editor-text-bold",
        italic: "documentation-editor-text-italic",
        underline: "documentation-editor-text-underline",
        strikethrough: "documentation-editor-text-strikethrough",
        code: "documentation-editor-inline-code",
    },
    link: "documentation-editor-link",
    code: "documentation-editor-code-block",
};

function getSelectedNode(selection) {
    const anchor = selection.anchor;
    const focus = selection.focus;
    const anchorNode = anchor.getNode();
    const focusNode = focus.getNode();

    if (anchorNode === focusNode) {
        return anchorNode;
    }

    if (selection.isBackward()) {
        return focus.offset === 0 ? anchorNode : focusNode;
    }

    return anchor.offset === 0 ? focusNode : anchorNode;
}

const SPEECH_REPLACEMENTS = [
    { pattern: /\b(?:comma|coma)\b/gi, replacement: "," },
    { pattern: /\b(?:full stop|fullstop|period|dot)\b/gi, replacement: "." },
    { pattern: /\b(?:question mark)\b/gi, replacement: "?" },
    { pattern: /\b(?:exclamation mark|exclamation point)\b/gi, replacement: "!" },
    { pattern: /\b(?:semicolon|semi colon)\b/gi, replacement: ";" },
    { pattern: /\b(?:colon)\b/gi, replacement: ":" },
    { pattern: /\b(?:dash|hyphen)\b/gi, replacement: "-" },
    { pattern: /\b(?:open bracket|open parenthesis)\b/gi, replacement: "(" },
    { pattern: /\b(?:close bracket|close parenthesis)\b/gi, replacement: ")" },
    { pattern: /\b(?:open square bracket)\b/gi, replacement: "[" },
    { pattern: /\b(?:close square bracket)\b/gi, replacement: "]" },
    { pattern: /\b(?:open curly bracket)\b/gi, replacement: "{" },
    { pattern: /\b(?:close curly bracket)\b/gi, replacement: "}" },
    { pattern: /\b(?:double quote|open quote|close quote|quotation mark)\b/gi, replacement: "\"" },
    { pattern: /\b(?:single quote|apostrophe)\b/gi, replacement: "'" },
    { pattern: /\b(?:new line|next line|line break)\b/gi, replacement: "\n" },
    { pattern: /\b(?:new paragraph|next paragraph|paragraph break)\b/gi, replacement: "\n\n" },
    { pattern: /कॉमा/gi, replacement: "," },
    { pattern: /अल्पविराम/gi, replacement: "," },
    { pattern: /पूर्ण\s*विराम/gi, replacement: "।" },
    { pattern: /प्रश्न\s*चिन्ह/gi, replacement: "?" },
    { pattern: /विस्मयादिबोधक\s*चिन्ह/gi, replacement: "!" },
    { pattern: /सेमी\s*कोलन|अर्ध\s*विराम/gi, replacement: ";" },
    { pattern: /कोलन|द्विबिंदु/gi, replacement: ":" },
    { pattern: /डैश|हाइफ़न|हाइफन/gi, replacement: "-" },
    { pattern: /ओपन\s*ब्रैकेट|खुला\s*कोष्ठक/gi, replacement: "(" },
    { pattern: /क्लोज\s*ब्रैकेट|बंद\s*कोष्ठक/gi, replacement: ")" },
    { pattern: /डबल\s*कोट|उद्धरण\s*चिन्ह/gi, replacement: "\"" },
    { pattern: /सिंगल\s*कोट|अपोस्ट्रॉफी/gi, replacement: "'" },
    { pattern: /नया\s*लाइन|अगला\s*लाइन|लाइन\s*ब्रेक/gi, replacement: "\n" },
    { pattern: /नया\s*पैराग्राफ|अगला\s*पैराग्राफ|पैराग्राफ\s*ब्रेक/gi, replacement: "\n\n" },
];

function applySpeechReplacements(text) {
    return SPEECH_REPLACEMENTS.reduce(
        (result, { pattern, replacement }) => result.replace(pattern, replacement),
        text
    );
}

function formatSpeechText(text) {
    if (!text) return "";

    const normalized = text
        .replace(/\s+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .trim();

    return applySpeechReplacements(normalized)
        .replace(/[ \t]+([,.;:!?।])/g, "$1")
        .replace(/([([{])\s+/g, "$1")
        .replace(/\s+([)\]}])/g, "$1")
        .replace(/([,.;:!?।])([^\s\n)\]}])/g, "$1 $2")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function ToolbarPlugin() {
    const [editor] = useLexicalComposerContext();
    const [blockType, setBlockType] = useState("paragraph");
    const [alignment, setAlignment] = useState("left");
    const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
    const [fontSize, setFontSize] = useState("15px");
    const [fontColor, setFontColor] = useState("#111827");
    const [highlightColor, setHighlightColor] = useState("#ffffff");
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [isCode, setIsCode] = useState(false);
    const [isLink, setIsLink] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [speechError, setSpeechError] = useState("");
    const [speechPreview, setSpeechPreview] = useState("");
    const [speechLanguage, setSpeechLanguage] = useState(SPEECH_LANGUAGES[0].value);
    const recognitionRef = useRef(null);
    const SpeechRecognitionCtor = useMemo(() => {
        if (typeof window === "undefined") return null;
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }, []);

    const updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        setIsBold(selection.hasFormat("bold"));
        setIsItalic(selection.hasFormat("italic"));
        setIsUnderline(selection.hasFormat("underline"));
        setIsStrikethrough(selection.hasFormat("strikethrough"));
        setIsCode(selection.hasFormat("code"));
        setFontFamily(
            $getSelectionStyleValueForProperty(selection, "font-family", FONT_FAMILIES[0].value)
        );
        setFontSize($getSelectionStyleValueForProperty(selection, "font-size", "15px"));
        setFontColor($getSelectionStyleValueForProperty(selection, "color", "#111827"));
        setHighlightColor(
            $getSelectionStyleValueForProperty(selection, "background-color", "#ffffff")
        );

        const selectedNode = getSelectedNode(selection);
        const parent = selectedNode.getParent();
        const linkNode = $isLinkNode(selectedNode) ? selectedNode : $isLinkNode(parent) ? parent : null;
        setIsLink(Boolean(linkNode));

        const topLevelElement =
            $findMatchingParent(selectedNode, (node) => {
                const parentNode = node.getParent();
                return parentNode !== null && $isRootOrShadowRoot(parentNode);
            }) || selectedNode.getTopLevelElementOrThrow();

        if ($isListNode(topLevelElement)) {
            setBlockType(topLevelElement.getListType());
        } else if ($isHeadingNode(topLevelElement)) {
            setBlockType(topLevelElement.getTag());
        } else if ($isCodeNode(topLevelElement)) {
            setBlockType("code");
        } else if (topLevelElement.getType() === "quote") {
            setBlockType("quote");
        } else {
            setBlockType("paragraph");
        }

        setAlignment(topLevelElement.getFormatType() || "left");
    }, []);

    useEffect(() => {
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => {
                editorState.read(() => {
                    updateToolbar();
                });
            }),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    updateToolbar();
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),
            editor.registerCommand(
                CAN_UNDO_COMMAND,
                (payload) => {
                    setCanUndo(payload);
                    return false;
                },
                COMMAND_PRIORITY_LOW
            ),
            editor.registerCommand(
                CAN_REDO_COMMAND,
                (payload) => {
                    setCanRedo(payload);
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, updateToolbar]);

    const setBlocks = (nextType) => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            if (nextType === "paragraph") {
                editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
                $setBlocksType(selection, () => $createParagraphNode());
                return;
            }

            if (nextType === "quote") {
                editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
                $setBlocksType(selection, () => $createQuoteNode());
                return;
            }

            if (nextType === "code") {
                editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
                $setBlocksType(selection, () => $createCodeNode());
                return;
            }

            if (nextType === "bullet") {
                editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
                return;
            }

            if (nextType === "number") {
                editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
                return;
            }

            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
            $setBlocksType(selection, () => $createHeadingNode(nextType));
        });
    };

    const patchSelectionStyle = (patch) => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            $patchStyleText(selection, patch);
        });
    };

    const insertTextAtSelection = useCallback((text) => {
        if (!text) return;
        editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
                selection.insertText(text);
                return;
            }

            const root = $getRoot();
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(text));
            root.append(paragraph);
            paragraph.selectEnd();
        });
    }, [editor]);

    const changeFontSize = (direction) => {
        const currentIndex = Math.max(0, FONT_SIZES.indexOf(fontSize));
        const nextIndex = Math.min(
            FONT_SIZES.length - 1,
            Math.max(0, currentIndex + direction)
        );
        const nextSize = FONT_SIZES[nextIndex];
        setFontSize(nextSize);
        patchSelectionStyle({ "font-size": nextSize });
    };

    const clearFormatting = () => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;

            ["bold", "italic", "underline", "strikethrough", "code"].forEach((format) => {
                if (selection.hasFormat(format)) {
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
                }
            });

            editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
            $setBlocksType(selection, () => $createParagraphNode());
            $patchStyleText(selection, {
                color: null,
                "background-color": null,
                "font-family": null,
                "font-size": null,
            });
        });
    };

    const toggleLink = () => {
        if (isLink) {
            editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
            return;
        }

        const url = window.prompt("Enter a URL", "https://");
        if (!url) return;
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    };

    useEffect(() => {
        if (!SpeechRecognitionCtor) return undefined;

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = speechLanguage;

        recognition.continuous = true;

        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let finalTranscript = "";
            let interimTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const transcript = event.results[i][0]?.transcript || "";
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            setSpeechPreview(formatSpeechText(interimTranscript));
            const formattedFinalTranscript = formatSpeechText(finalTranscript).trim();
            if (formattedFinalTranscript) {
                insertTextAtSelection(`${formattedFinalTranscript} `);
            }
        };

        recognition.onerror = (event) => {
            const nextError =
                event.error === "not-allowed"
                    ? "Microphone access was blocked."
                    : event.error === "no-speech"
                        ? "No speech detected."
                        : `Speech input failed: ${event.error}`;
            setSpeechError(nextError);
            setIsListening(false);
            setSpeechPreview("");
        };

        recognition.onend = () => {
            setIsListening(false);
            setSpeechPreview("");
        };

        recognitionRef.current = recognition;
        return () => {
            recognition.stop();
            recognitionRef.current = null;
        };
    }, [SpeechRecognitionCtor, insertTextAtSelection, speechLanguage]);

    useEffect(() => {
        if (recognitionRef.current) {
            recognitionRef.current.lang = speechLanguage;
        }
    }, [speechLanguage]);

    const toggleSpeechToText = () => {
        if (!recognitionRef.current) {
            setSpeechError("Speech-to-text is not supported in this browser.");
            return;
        }

        setSpeechError("");

        if (isListening) {
            recognitionRef.current.stop();
            return;
        }

        editor.focus();
        setSpeechPreview("");

        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch {
            setSpeechError("Microphone could not start.");
            setIsListening(false);
        }
    };

    return (
        <div className="documentation-editor-toolbar">
            <div className="documentation-editor-toolbar-group">
                <button
                    type="button"
                    className="documentation-toolbar-button"
                    onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
                    disabled={!canUndo}
                    title="Undo"
                >
                    <i className="bi bi-arrow-counterclockwise documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className="documentation-toolbar-button"
                    onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
                    disabled={!canRedo}
                    title="Redo"
                >
                    <i className="bi bi-arrow-clockwise documentation-toolbar-icon" aria-hidden="true" />
                </button>
            </div>

            <div className="documentation-editor-toolbar-group">
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "paragraph" ? "active" : ""}`}
                    onClick={() => setBlocks("paragraph")}
                    title="Paragraph"
                >
                    <i className="bi bi-paragraph documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "h1" ? "active" : ""}`}
                    onClick={() => setBlocks("h1")}
                    title="Heading 1"
                >
                    <i className="bi bi-type-h1 documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "h2" ? "active" : ""}`}
                    onClick={() => setBlocks("h2")}
                    title="Heading 2"
                >
                    <i className="bi bi-type-h2 documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "h3" ? "active" : ""}`}
                    onClick={() => setBlocks("h3")}
                    title="Heading 3"
                >
                    <i className="bi bi-type-h3 documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "quote" ? "active" : ""}`}
                    onClick={() => setBlocks("quote")}
                    title="Quote"
                >
                    <i className="bi bi-blockquote-left documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "code" ? "active" : ""}`}
                    onClick={() => setBlocks("code")}
                    title="Code block"
                >
                    <i className="bi bi-code-slash documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "bullet" ? "active" : ""}`}
                    onClick={() => setBlocks("bullet")}
                    title="Bulleted list"
                >
                    <i className="bi bi-list-ul documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${blockType === "number" ? "active" : ""}`}
                    onClick={() => setBlocks("number")}
                    title="Numbered list"
                >
                    <i className="bi bi-list-ol documentation-toolbar-icon" aria-hidden="true" />
                </button>
            </div>

            <div className="documentation-editor-toolbar-group">
                <span className="documentation-toolbar-addon" title="Font family">
                    <i className="bi bi-fonts documentation-toolbar-icon" aria-hidden="true" />
                </span>
                <select
                    className="documentation-toolbar-select documentation-toolbar-select-font"
                    value={fontFamily}
                    onChange={(event) => {
                        setFontFamily(event.target.value);
                        patchSelectionStyle({ "font-family": event.target.value });
                    }}
                    title="Font family"
                >
                    {FONT_FAMILIES.map((family) => (
                        <option key={family.label} value={family.value}>
                            {family.label}
                        </option>
                    ))}
                </select>
                <div className="documentation-toolbar-size-control">
                    <button
                        type="button"
                        className="documentation-toolbar-button documentation-toolbar-button-small"
                        onClick={() => changeFontSize(-1)}
                        title="Decrease font size"
                    >
                        <i className="bi bi-dash-lg documentation-toolbar-icon" aria-hidden="true" />
                    </button>
                    <select
                        className="documentation-toolbar-select documentation-toolbar-select-compact"
                        value={fontSize}
                        onChange={(event) => {
                            setFontSize(event.target.value);
                            patchSelectionStyle({ "font-size": event.target.value });
                        }}
                        title="Font size"
                    >
                        {FONT_SIZES.map((size) => (
                            <option key={size} value={size}>
                                {parseInt(size, 10)}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        className="documentation-toolbar-button documentation-toolbar-button-small"
                        onClick={() => changeFontSize(1)}
                        title="Increase font size"
                    >
                        <i className="bi bi-plus-lg documentation-toolbar-icon" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="documentation-editor-toolbar-group">
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isBold ? "active" : ""}`}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
                    title="Bold"
                >
                    <i className="bi bi-type-bold documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isItalic ? "active" : ""}`}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
                    title="Italic"
                >
                    <i className="bi bi-type-italic documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isUnderline ? "active" : ""}`}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
                    title="Underline"
                >
                    <i className="bi bi-type-underline documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isStrikethrough ? "active" : ""}`}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")}
                    title="Strikethrough"
                >
                    <i className="bi bi-type-strikethrough documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isCode ? "active" : ""}`}
                    onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")}
                    title="Inline code"
                >
                    <i className="bi bi-code-slash documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isLink ? "active" : ""}`}
                    onClick={toggleLink}
                    title="Insert link"
                >
                    <i className="bi bi-link-45deg documentation-toolbar-icon" aria-hidden="true" />
                </button>
            </div>

            <div className="documentation-editor-toolbar-group">
                <label className="documentation-color-control" title="Text color">
                    <i className="bi bi-type documentation-toolbar-icon" aria-hidden="true" />
                    <input
                        type="color"
                        value={fontColor}
                        onChange={(event) => {
                            setFontColor(event.target.value);
                            patchSelectionStyle({ color: event.target.value });
                        }}
                    />
                </label>
                <label className="documentation-color-control" title="Highlight color">
                    <i className="bi bi-highlighter documentation-toolbar-icon" aria-hidden="true" />
                    <input
                        type="color"
                        value={highlightColor === "transparent" ? "#ffffff" : highlightColor}
                        onChange={(event) => {
                            setHighlightColor(event.target.value);
                            patchSelectionStyle({ "background-color": event.target.value });
                        }}
                    />
                </label>
                <button
                    type="button"
                    className="documentation-toolbar-button"
                    onClick={clearFormatting}
                    title="Clear formatting"
                >
                    <i className="bi bi-eraser documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <select
                    className="documentation-toolbar-select documentation-toolbar-select-compact documentation-toolbar-select-language"
                    value={speechLanguage}
                    onChange={(event) => setSpeechLanguage(event.target.value)}
                    disabled={isListening}
                    title={isListening ? "Stop speech-to-text to change language" : "Speech language"}
                    aria-label="Speech language"
                >
                    {SPEECH_LANGUAGES.map((language) => (
                        <option key={language.value} value={language.value}>
                            {language.label}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${isListening ? "active documentation-toolbar-button-listening" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={toggleSpeechToText}
                    title={
                        SpeechRecognitionCtor
                            ? (isListening ? "Stop speech-to-text" : "Start speech-to-text")
                            : "Speech-to-text unavailable"
                    }
                >
                    <i
                        className={`bi ${isListening ? "bi-stop-fill" : "bi-mic-fill"} documentation-toolbar-icon`}
                        aria-hidden="true"
                    />
                </button>
            </div>

            <div className="documentation-editor-toolbar-group">
                <button
                    type="button"
                    className={`documentation-toolbar-button ${alignment === "left" ? "active" : ""}`}
                    onClick={() => {
                        setAlignment("left");
                        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left");
                    }}
                    title="Align left"
                >
                    <i className="bi bi-text-left documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${alignment === "center" ? "active" : ""}`}
                    onClick={() => {
                        setAlignment("center");
                        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center");
                    }}
                >
                    <i className="bi bi-text-center documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${alignment === "right" ? "active" : ""}`}
                    onClick={() => {
                        setAlignment("right");
                        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right");
                    }}
                    title="Align right"
                >
                    <i className="bi bi-text-right documentation-toolbar-icon" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    className={`documentation-toolbar-button ${alignment === "justify" ? "active" : ""}`}
                    onClick={() => {
                        setAlignment("justify");
                        editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify");
                    }}
                    title="Justify"
                >
                    <i className="bi bi-justify documentation-toolbar-icon" aria-hidden="true" />
                </button>
            </div>
            {(speechError || isListening || speechPreview) && (
                <div className="documentation-editor-toolbar-group documentation-editor-toolbar-group-status">
                    <span className={`documentation-speech-status ${speechError ? "error" : ""}`}>
                        {speechError || (isListening ? `Listening${speechPreview ? `: ${speechPreview}` : "..."}` : "")}
                    </span>
                </div>
            )}
        </div>
    );
}

export default function LexicalEditor({ documentId, initialState, onChange }) {
    const initialConfig = {
        namespace: `documentation-editor-${documentId}`,
        theme: editorTheme,
        nodes: [
            HeadingNode,
            QuoteNode,
            ListNode,
            ListItemNode,
            LinkNode,
            AutoLinkNode,
            CodeNode,
            CodeHighlightNode,
        ],
        editorState:
            initialState ||
            (() => {
                const root = $getRoot();
                const paragraph = $createParagraphNode();
                root.clear();
                root.append(paragraph);
            }),
        onError(error) {
            throw error;
        },
    };

    return (
        <div className="documentation-editor-shell">
            <LexicalComposer initialConfig={initialConfig}>
                <ToolbarPlugin />
                <div className="documentation-editor-inner">
                    <RichTextPlugin
                        contentEditable={
                            <ContentEditable className="documentation-editor-content" />
                        }
                        placeholder={
                            <div className="documentation-editor-placeholder">
                                Start writing...
                            </div>
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                    />
                    <HistoryPlugin />
                    <ListPlugin />
                    <LinkPlugin />
                    <AutoFocusPlugin />
                    <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
                    <OnChangePlugin
                        onChange={(editorState) => {
                            onChange(JSON.stringify(editorState.toJSON()));
                        }}
                    />
                </div>
            </LexicalComposer>
        </div>
    );
}
