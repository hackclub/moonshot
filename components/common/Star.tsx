function Star() {
    const randomX = Math.round(Math.random() * 99);
    const randomY = Math.floor(Math.random() * 99);
    return (
      <div
        style={{
          left: `${randomX}%`,
          top: `${randomY}%`,
        }}
        className={"absolute z-0 h-px w-px md:h-[2px] md:w-[2px] rounded-full bg-white opacity-90"}
      />
    );
  }

export default Star;