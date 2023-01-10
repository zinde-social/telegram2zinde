import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  MessageData,
  ParseMessageText,
  signerPostNote,
} from "@/common/contract";
import Loading from "@/components/Loading";
import { getProgress, getSetting, setProgress } from "@/common/session";
import { AccessTime, Add, AddTask, Check } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

interface messagesPendingMigration {
  // Original message data
  message: MessageData;

  // Let user select this
  isToMigrate: boolean;

  // Status
  isPendingMigrate: boolean;
  isMigrated: boolean;
}

const Migrate = () => {
  const [isLoading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState(
    "Loading collections..."
  );

  const [isShowingError, setShowingError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [messages, setMessages] = useState<messagesPendingMigration[]>([]);

  const loadMessages = async () => {
    // Set
    setLoadingMessage("Loading messages...");
    setLoading(true);

    // Get settings
    const settings = getSetting();

    try {
      // Load file
      const results = await fetch("result.json").then((res) => res.json());

      const currentProgress = getProgress();

      const parsedMessages = results.messages.map(
        (msg: MessageData): messagesPendingMigration => {
          const isService = msg.type === "service";
          const isMigrated = currentProgress.finishedIDs.includes(msg.id);
          return {
            message: msg,
            isToMigrate: !isMigrated && (settings.includeService || !isService),
            isPendingMigrate: false,
            isMigrated,
          };
        }
      );

      console.log("Parsed messages: ", parsedMessages);

      setMessages(parsedMessages);
    } catch (e: any) {
      setErrorMessage(e.message);
      setShowingError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
  }, []);

  const nav = useNavigate();

  return (
    <>
      <Loading open={isLoading} message={loadingMessage} />

      {/*Error Dialog*/}
      <Dialog
        open={isShowingError}
        onClose={() => {
          setShowingError(false);
        }}
        aria-labelledby="error-dialog-title"
        aria-describedby="error-dialog-description"
      >
        <DialogTitle id="error-dialog-title">{"Oops"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="error-dialog-description">
            {errorMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setShowingError(false);
            }}
            autoFocus
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h5">
          Migrate
        </Typography>

        <Box
          sx={{
            marginTop: 2,
          }}
        >
          <Button
            type="button"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            onClick={async () => {
              setLoading(true);
              setLoadingMessage("Initializing basic information...");

              setProgress({
                ...getProgress(),
                finishedIDs: [],
              });

              try {
                for (let index = 0; index < messages.length; index++) {
                  const wrappedMessage = messages[index];
                  setLoadingMessage(
                    `Processing ${index} of ${messages.length} notes...`
                  );
                  if (wrappedMessage.isToMigrate) {
                    setMessages(
                      messages
                        .slice(0, index)
                        .concat([
                          {
                            ...wrappedMessage,
                            isPendingMigrate: true,
                          },
                        ])
                        .concat(messages.slice(index + 1, messages.length))
                    );
                    await signerPostNote(wrappedMessage.message);
                    const progress = getProgress();
                    setProgress({
                      ...progress,
                      finishedIDs: progress.finishedIDs.concat(
                        wrappedMessage.message.id
                      ),
                    });
                    setMessages(
                      messages
                        .slice(0, index)
                        .concat([
                          {
                            ...wrappedMessage,
                            isPendingMigrate: false,
                            isMigrated: true,
                          },
                        ])
                        .concat(messages.slice(index + 1, messages.length))
                    );
                  }
                }

                console.log("All finished");

                nav("/finish");
              } catch (e: any) {
                console.log(e);
                setErrorMessage(e.message);
                setShowingError(true);
              }

              setLoading(false);
            }}
          >
            Start processing
          </Button>
        </Box>

        <Box display={"flex"} flexDirection={"row"} width={"100%"} mt={8}>
          <Box flex={1}>
            <List>
              {messages.map((wrappedMessage, index) => (
                <ListItem key={wrappedMessage.message.id}>
                  <ListItemButton
                    onClick={() => {
                      setMessages(
                        messages
                          .slice(0, index)
                          .concat([
                            {
                              ...wrappedMessage,
                              isToMigrate: !wrappedMessage.isToMigrate,
                            },
                          ])
                          .concat(messages.slice(index + 1, messages.length))
                      );
                    }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge={"start"}
                        checked={wrappedMessage.isToMigrate}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", flexDirection: "column" }}>
                          <span>
                            {ParseMessageText(wrappedMessage.message)}
                          </span>
                          {/*Photo*/}
                          {wrappedMessage.message.photo && (
                            <img
                              src={wrappedMessage.message.photo}
                              alt={wrappedMessage.message.photo}
                              width={300}
                            />
                          )}
                          {/*Attachment*/}
                          {wrappedMessage.message.file &&
                            (wrappedMessage.message.mime_type?.startsWith(
                              "image"
                            ) ? (
                              <img
                                src={wrappedMessage.message.file}
                                width={300}
                              />
                            ) : wrappedMessage.message.mime_type?.startsWith(
                                "audio"
                              ) ? (
                              <audio controls>
                                <source
                                  src={wrappedMessage.message.file}
                                  type={wrappedMessage.message.mime_type}
                                />
                                Your browser does not support the audio tag.
                              </audio>
                            ) : wrappedMessage.message.mime_type?.startsWith(
                                "video"
                              ) ? (
                              <video controls width={300}>
                                <source
                                  src={wrappedMessage.message.file}
                                  type={wrappedMessage.message.mime_type}
                                />
                                Your browser does not support the video tag.
                              </video>
                            ) : (
                              <div>
                                Unknown file: {wrappedMessage.message.file} (
                                {wrappedMessage.message.mime_type})
                              </div>
                            ))}
                        </Box>
                      }
                      secondary={new Date(
                        wrappedMessage.message.date
                      ).toLocaleString()}
                      style={{
                        whiteSpace: "pre-wrap",
                      }}
                    />
                    <ListItemIcon>
                      {wrappedMessage.isMigrated ? (
                        <Check />
                      ) : wrappedMessage.isPendingMigrate ? (
                        <AccessTime />
                      ) : wrappedMessage.isToMigrate ? (
                        <AddTask />
                      ) : (
                        <></>
                      )}
                    </ListItemIcon>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      </Box>
    </>
  );
};

export default Migrate;
