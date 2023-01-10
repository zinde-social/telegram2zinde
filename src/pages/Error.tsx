import React from "react";
import { Box, Typography } from "@mui/material";

const Error = () => {
  return (
    <Box
      sx={{
        marginTop: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography component="h3" variant="h5">
        Failed to detect necessary data
      </Typography>
      <Box
        sx={{
          marginTop: 2,
        }}
      >
        <Typography>
          It seems we cannot detect necessary data. <br />
          Please put these files into your Telegram exported data's directory.
        </Typography>
      </Box>
    </Box>
  );
};

export default Error;
