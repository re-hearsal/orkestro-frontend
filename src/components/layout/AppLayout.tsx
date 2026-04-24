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
        }}
      >
        <TopBar unreadCount={unreadCount} />
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "#f5f5f5",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
