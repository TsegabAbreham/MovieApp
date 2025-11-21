export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
      <div className="flex flex-col items-center">
        <div className="loader mb-2"></div>
        <span className="text-white text-sm mt-2">Loading...</span>
      </div>

      <style jsx>{`
        .loader {
          border: 6px solid rgba(255, 255, 255, 0.2);
          border-top: 6px solid #fff;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
