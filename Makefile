.PHONY: all frontend backend build install install-service uninstall uninstall-service restart clean run dev test help

NAME := openmkview
VERSION := $(shell cargo metadata --no-deps --format-version 1 2>/dev/null | jq -r '.packages[0].version' 2>/dev/null || echo "0.2.0")
CARGO_BINDIR := $(HOME)/.cargo/bin
SYSTEMD_USER_DIR := $(HOME)/.config/systemd/user

all: build

frontend:
	cd frontend && npm install && npm run build

backend:
	cargo build --release

build: frontend backend

install: build
	@mkdir -p $(CARGO_BINDIR)
	@install -m 755 target/release/$(NAME) $(CARGO_BINDIR)/$(NAME)
	@echo "Installed $(NAME) to $(CARGO_BINDIR)"

install-service:
	@mkdir -p $(SYSTEMD_USER_DIR)
	@sed 's|{{BINDIR}}|$(CARGO_BINDIR)|g' contrib/$(NAME).service.in > $(SYSTEMD_USER_DIR)/$(NAME).service
	@systemctl --user daemon-reload
	@echo "Installed systemd user service"
ifdef ENABLE
	@systemctl --user enable $(NAME)
	@echo "Service enabled"
endif
ifdef START
	@systemctl --user enable $(NAME) 2>/dev/null || true
	@systemctl --user start $(NAME)
	@echo "Service enabled and started"
endif
ifndef ENABLE
ifndef START
	@echo "Enable with: systemctl --user enable $(NAME)"
	@echo "Start with: systemctl --user start $(NAME)"
endif
endif

uninstall:
	@rm -f $(CARGO_BINDIR)/$(NAME)
	@echo "Uninstalled $(NAME)"

uninstall-service:
	@systemctl --user stop $(NAME) 2>/dev/null || true
	@systemctl --user disable $(NAME) 2>/dev/null || true
	@rm -f $(SYSTEMD_USER_DIR)/$(NAME).service
	@systemctl --user daemon-reload
	@echo "Uninstalled systemd user service"

restart:
	@systemctl --user restart $(NAME)
	@echo "Service $(NAME) restarted"

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
	@echo "  install         Install binary via cargo install to $(CARGO_BINDIR)"
	@echo "  install-service Install systemd user service only"
	@echo "                  ENABLE=1 to enable service"
	@echo "                  START=1 to enable and start service"
	@echo "  uninstall       Remove binary via cargo uninstall"
	@echo "  uninstall-service Remove systemd user service"
	@echo "  restart         Restart systemd user service"
	@echo "  clean           Remove build artifacts"
	@echo "  run             Run the server (development)"
	@echo "  dev             Run frontend dev server"
	@echo "  test            Run tests"
	@echo ""
	@echo "Variables:"
	@echo "  ENABLE=1         Enable service after install"
	@echo "  START=1          Enable and start service after install"