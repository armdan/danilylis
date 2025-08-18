<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - Laboratory Information System</title>

  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- Font Awesome -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" rel="stylesheet">
  <!-- Page CSS -->
  <link href="css/dashboard.css" rel="stylesheet">
</head>
<body>
  <!-- Navbar will be injected by navbar-loader.js -->

  <!-- Main Content -->
  <div class="container-fluid main-content">
    <div class="row">
      <div class="col-12">
        <div class="welcome-section">
          <h1 class="welcome-title">Welcome back, <span id="welcomeUserName">User</span>!</h1>
          <p class="welcome-subtitle">Here's what's happening in your laboratory today</p>
        </div>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div class="row mb-4">
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="stat-card stat-card-primary">
          <div class="stat-card-body">
            <div class="row no-gutters align-items-center">
              <div class="col mr-2">
                <div class="stat-title">Total Patients</div>
                <div class="stat-number" id="totalPatients">-</div>
              </div>
              <div class="col-auto">
                <i class="fas fa-users stat-icon"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- other 3 cards unchanged -->
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="stat-card stat-card-success">
          <div class="stat-card-body">
            <div class="row no-gutters align-items-center">
              <div class="col mr-2">
                <div class="stat-title">Pending Orders</div>
                <div class="stat-number" id="pendingOrders">-</div>
              </div>
              <div class="col-auto">
                <i class="fas fa-clipboard-list stat-icon"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="stat-card stat-card-info">
          <div class="stat-card-body">
            <div class="row no-gutters align-items-center">
              <div class="col mr-2">
                <div class="stat-title">Completed Tests</div>
                <div class="stat-number" id="completedTests">-</div>
              </div>
              <div class="col-auto">
                <i class="fas fa-vial stat-icon"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-xl-3 col-md-6 mb-4">
        <div class="stat-card stat-card-warning">
          <div class="stat-card-body">
            <div class="row no-gutters align-items-center">
              <div class="col mr-2">
                <div class="stat-title">Critical Results</div>
                <div class="stat-number" id="criticalResults">-</div>
              </div>
              <div class="col-auto">
                <i class="fas fa-exclamation-triangle stat-icon"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- (Recent Orders, Quick Actions, System Status, Alerts…) exactly same as your file -->
    <!-- ... -->
  </div>

  <!-- Scripts (ORDER MATTERS) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" defer></script>

  <!-- Auth FIRST, then Navbar, then Dashboard -->
  <script src="/js/auth.js" defer></script>
  <script src="/js/navbar-loader.js" defer></script>
  <script src="/js/dashboard.js" defer></script>
</body>
</html>
