import { Box } from "@mui/material";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useNotifications } from "../../hooks/useNotifications";

export default function AppLayout() {
  const { unreadCount } = useNotifications();

  return (
    <Box sx={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          ml: "220px",
          backgroundColor: "#0f3eb5",
        }}
      >
        <TopBar unreadCount={unreadCount} />
        <Box
          sx={{
            flex: 1,
            backgroundColor: "#fff",
            borderTopLeftRadius: "32px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box sx={{ height: "100%", overflow: "auto", backgroundColor: "#fff" }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
