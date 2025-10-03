function Star() {
    const randomX = Math.round(Math.random() * 99);
    const randomY = Math.floor(Math.random() * 99);
    return (
      <div
        style={{
          left: `${randomX}%`,
          top: `${randomY}%`,
        }}
        className={"absolute z-20 h-2 w-2 rounded-full bg-white blur-xs"}
      />
    );
  }

export default Star;