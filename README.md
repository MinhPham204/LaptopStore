# Laptop Store - E-commerce & AI Recommendation System

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![Status](https://img.shields.io/badge/status-active-success)

**Laptop Store** is a specialized e-commerce platform for laptops, featuring a core **Recommendation Service** powered by a custom **KNN (K-Nearest Neighbors)** algorithm. The system analyzes hardware specifications (CPU, GPU, RAM, Storage) to calculate performance scores and suggest the best matching products for customers.

The project is built with a modern Microservices-oriented architecture using **React**, **Node.js**, and **Python**.

---

## Features & Business Logic

The system is designed to serve two main user groups with distinct roles:

### 1. Customer (End-User)
* **Smart Search & Discovery:**
    * Search products by keywords, categories, or brands.
    * **AI Recommendation:** View similar product suggestions based on technical specs (Weighted Euclidean Distance).
    * Advanced Filtering: Filter by Price, CPU, RAM, GPU, and Brand.
* **Cart & Checkout:**
    * Manage cart items with support for product variants (Configuration options).
    * Secure checkout process with **VNPAY** integration or COD (Cash on Delivery).
* **Order Management:**
    * Track real-time order status (Pending -> Processing -> Shipped -> Completed).
    * View order history and manage shipping addresses (Integrated Maps).
* **Interaction:**
    * Q&A section for product inquiries.

### 2. Administrator (Admin)
* **Dashboard:** Overview of business performance and statistics.
* **Product Management:**
    * Full CRUD operations for products and variants.
    * Stock management and image uploading (Cloudinary integration).
* **Order Fulfillment:**
    * **Real-time Notifications:** Receive alerts for new orders instantly via Socket.io.
    * Workflow Management: Update order statuses (Processing, Packed, Shipped).
    * Automated email notifications to customers upon status changes.
* **Customer Support:** View customer lists and manage Q&A.

---

## Tech Stack

### Frontend (Client)
* **Framework:** React 18, Vite
* **State Management:** Redux Toolkit, React Query (TanStack Query)
* **UI Library:** Tailwind CSS, Headless UI
* **Maps:** React Leaflet
* **Real-time:** Socket.io-client

### Backend (Server API)
* **Runtime:** Node.js, Express.js
* **Database:** PostgreSQL (Sequelize ORM)
* **Authentication:** Passport.js (Google/Facebook OAuth), JWT
* **Services:** Cloudinary (Media), Nodemailer (Email), VNPAY (Payment)

### Recommendation Service (AI Core)
* **Language:** Python 3
* **Algorithm:** Custom Weighted KNN (Performance scoring based on CPU 40%, GPU 35%, RAM 15%, Storage 10%)
* **Libraries:** NumPy, Pandas, Scikit-learn, Flask

---

## Installation & Setup (Docker)

This project is configured with **Docker Compose** for easy deployment.

### Prerequisites
* [Docker](https://www.docker.com/) and Docker Compose installed.
* Git installed.

### Steps

1.  **Clone the repository**
    ```bash
    git clone [https://github.com/minhpham204/laptopstore.git](https://github.com/minhpham204/laptopstore.git)
    cd laptopstore
    ```

2.  **Environment Configuration**
    Create a `.env` file in the root directory (or in each service folder `client/`, `server/`, `recommendation_service/`) based on `env-example.txt`.
    * *Note: Ensure you provide valid API Keys for Cloudinary, VNPAY, and OAuth services.*

3.  **Run with Docker Compose**
    ```bash
    docker-compose up --build
    ```
    This command will build and start the Client, Server, Recommendation Service, and PostgreSQL database.

4.  **Access the Application**
    * **Frontend:** `http://localhost:5173`
    * **Backend API:** `http://localhost:5000`
    * **Recommendation Service:** `http://localhost:8000`

---

## Database Seeding

To initialize the database with a default **Admin account**, run the following command in a separate terminal while the containers are running:

```bash
docker-compose exec server npm run seed:admin
