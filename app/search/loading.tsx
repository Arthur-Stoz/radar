export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading results">
      <div className="h-16 border-b border-line sm:h-[72px]" />
      <div className="px-5 pt-7 sm:px-10">
        <div className="skeleton h-9 w-[60%] max-w-[420px] rounded-[12px]" />
        <div className="mt-6 flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2 lg:max-w-[calc(100%-552px)]">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-[112px] rounded-[20px]" />
          ))}
        </div>
      </div>
    </div>
  );
}
