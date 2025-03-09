'use client'

import { FC, useEffect } from "react";

interface GenerationDataLoggerProps {
  data: any;
}

const GenerationDataLogger: FC<GenerationDataLoggerProps> = ({ data }) => {
  useEffect(() => {
    console.log("Image generation details:", data);
  }, [data]);
  
  return null; // This component doesn't render anything
};

export default GenerationDataLogger; 