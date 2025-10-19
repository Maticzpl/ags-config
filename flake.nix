{
  description = "My Awesome Desktop Shell";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";

    ags = {
      url = "github:aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    ags,
  }: let
    system = "x86_64-linux";
    pkgs = nixpkgs.legacyPackages.${system};
    pname = "custom-widgets";
    entry = "app.ts";

    astalPackages = with ags.packages.${system}; [
      io
      hyprland
      bluetooth
      battery
      mpris
      network
      
      tray
      apps

      astal4 # or astal3 for gtk3
      # notifd tray wireplumber
    ];

    extraPackages =
      astalPackages
      ++ [
        pkgs.libadwaita
        pkgs.libsoup_3
        pkgs.gtk4
      ];
  in {
    packages.${system} = {
      default = pkgs.stdenv.mkDerivation {
        name = pname;
        src = ./.;

        nativeBuildInputs = with pkgs; [
          wrapGAppsHook
          gobject-introspection
          ags.packages.${system}.default
        ];

        buildInputs = extraPackages ++ [pkgs.gjs];

        installPhase = ''
          runHook preInstall

          mkdir -p $out/bin
          mkdir -p $out/share
          cp -r * $out/share
          ags bundle ${entry} $out/bin/${pname} -d "SRC='$out/share'"

          runHook postInstall
        '';
      };
    };
    # ags types -d "/home/maticzpl/Documents/dev/ags-config" "Astal*"

    devShells.${system} = {
      default = pkgs.mkShell {
        buildInputs = [
          (ags.packages.${system}.default.override {
            inherit extraPackages;
          })
          pkgs.nodejs

          pkgs.glib
          pkgs.gobject-introspection
          pkgs.libadwaita
          pkgs.libsoup_3
          pkgs.gtk4

          pkgs.atop
          pkgs.jq
        ] ++ astalPackages;
      };
    };
  };
}
