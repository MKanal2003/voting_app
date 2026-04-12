# Build stage — compile the .NET code
FROM --platform=${BUILDPLATFORM} mcr.microsoft.com/dotnet/sdk:7.0 AS build
ARG TARGETARCH

WORKDIR /source

# Copy project file and restore packages first (caching trick)
COPY *.csproj .
RUN dotnet restore -a $TARGETARCH

# Copy source code and publish (compile to binary)
COPY . .
RUN dotnet publish -c release -o /app -a $TARGETARCH --self-contained false --no-restore

# Run stage — much smaller image, no SDK needed
FROM mcr.microsoft.com/dotnet/runtime:7.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Worker.dll"]