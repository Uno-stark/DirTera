import { memo } from "react";
import { Star } from "lucide-react";

function Stars({ value, size = 13, filled = "star star-filled", empty = "star star-empty" }) {
  const fullCount  = Math.round(value);
  const emptyCount = 5 - fullCount;

  return (
    <span className="star-row" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: fullCount }).map((_, i) => (
        <Star
          key={`f${i}`}
          size={size}
          className={filled}
          fill="currentColor"
          strokeWidth={0}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <Star
          key={`e${i}`}
          size={size}
          className={empty}
          fill="none"
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export default memo(Stars);
