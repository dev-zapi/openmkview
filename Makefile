.PHONY: all frontend backend build install install-service uninstall uninstall-service clean run dev test help

NAME := openmkview
VERSION := $(shell cargo metadata --no-deps --format-version 1 2>/dev/null | jq -r '.packages[0].version' 2>/dev/null || echo "0.2.0")
PREFIX ?= $(HOME)/.local
BINDIR := $(PREFIX)/bin
SYSTEMD_USER_DIR := $(HOME)/.config/systemd/user

all: build

frontend:
	cd frontend && npm install && npm run build

backend:
	cargo build --release

build: frontend backend

install: build
	@mkdir -p $(BINDIR)
	@install -m 755 target/release/$(NAME) $(BINDIR)/$(NAME)
	@echo "Installed $(NAME) to $(BINDIR)"

install-service: install
	@mkdir -p $(SYSTEMD_USER_DIR)
	@sed 's|{{BINDIR}}|$(BINDIR)|g' contrib/$(NAME).service.in > $(SYSTEMD_USER_DIR)/$(NAME).service
	@systemctl --user daemon-reload
	@echo "Installed systemd user service"
	@echo "Enable with: systemctl --user enable $(NAME)"
	@echo "Start with: systemctl --user start $(NAME)"

uninstall:
	@rm -f $(BINDIR)/$(NAME)
	@echo "Uninstalled $(NAME) from $(BINDIR)"

uninstall-service:
	@systemctl --user stop $(NAME) 2>/dev/null || true
	@systemctl --user disable $(NAME) 2>/dev/null || true
	@rm -f $(SYSTEMD_USER_DIR)/$(NAME).service
	@systemctl --user daemon-reload
	@echo "Uninstalled systemd user service"

clean:
	cargo clean
	rm -rf dist
	cd frontend && rm -rf node_modules dist

run:
	cargo run

dev:
	cd frontend && npm run dev

test:
	cargo test
	cd frontend && npm test

help:
	@echo "OpenMKView Makefile"
	@echo ""
	@echo "Targets:"
	@echo "  frontend        Build frontend only"
	@echo "  backend         Build backend only"
	@echo "  build           Build both frontend and backend (default)"
	@echo "  install         Install binary to $(BINDIR)"
	@echo "  install-service Install binary and systemd user service"
	@echo "  uninstall       Remove binary from $(BINDIR)"
	@echo "  uninstall-service Remove systemd user service"
	@echo "  clean           Remove build artifacts"
	@echo "  run             Run the server (development)"
	@echo "  dev             Run frontend dev server"
	@echo "  test            Run tests"
	@echo ""
	@echo "Variables:"
	@echo "  PREFIX=$(PREFIX)"
	@echo "  BINDIR=$(BINDIR)"