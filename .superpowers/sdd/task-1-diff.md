diff --git a/src/components/WordCard.tsx b/src/components/WordCard.tsx
index 63f01ad..016914b 100644
--- a/src/components/WordCard.tsx
+++ b/src/components/WordCard.tsx
@@ -124,21 +124,21 @@ export function WordCard({ word, isLoading, onSpeak, onSpeakExample, accent, onN
           >
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
               <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
             </svg>
           </Button>
         </div>
 
         {/* Core Content */}
         <CardContent className="flex-1 flex flex-col items-center justify-center w-full py-6 px-0">
           {/* Word */}
-          <h1 className="text-5xl sm:text-6xl font-bold text-gradient text-center mb-6 tracking-tight">
+          <h1 className="word-title text-gradient text-center mb-6 tracking-tight">
             {word.word}
           </h1>
 
           {/* Phonetic & Accent */}
           <div className="flex items-center gap-2 mb-8">
             <span className="text-base text-muted-foreground font-medium">
               {word.phonetic}
             </span>
             <div className="w-px h-3 bg-border"></div>
             <span className="text-xs uppercase font-semibold tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded">
diff --git a/src/index.css b/src/index.css
index 9c91071..a8d5561 100644
--- a/src/index.css
+++ b/src/index.css
@@ -208,10 +208,20 @@ body {
     transform: translateY(-2px);
     box-shadow:
       0 12px 40px rgba(0, 0, 0, 0.4),
       inset 0 1px 0 rgba(255, 255, 255, 0.08);
   }
 }
 
 .card-hover {
   transition: transform 0.3s ease, box-shadow 0.3s ease;
 }
+
+/* Word title responsive sizing */
+.word-title {
+  font-size: clamp(1.75rem, 8vw, 3.75rem);
+  font-weight: 700;
+  word-break: break-word;
+  line-height: 1.4;
+  padding-bottom: 4px;
+  max-width: 100%;
+}
