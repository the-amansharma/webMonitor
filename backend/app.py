if __name__ == "__main__":
    import os

    # Start the background monitor thread
    threading.Thread(target=background_monitor, daemon=True).start()

    # Get port from environment (Render) or default to 5000 for local testing
    port = int(os.environ.get("PORT", 5000))
    
    # Run Flask
    app.run(host="0.0.0.0", port=port)  # remove debug=True for production