import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ParentsService } from './parents.service';
import { ParentProfileDto } from './dto/parent-profile.dto';
import { LinkChildDto } from './dto/link-child.dto';
import { ParentResponseDto, PaginatedParentsResponseDto } from './dto/parent-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('parents')
@Controller('parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post('profile')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Create parent profile' })
  @ApiResponse({
    status: 201,
    description: 'Parent profile created successfully',
    type: ParentResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Parent profile already exists' })
  async createProfile(
    @Body() parentProfileDto: ParentProfileDto,
    @Request() req: any,
  ): Promise<ParentResponseDto> {
    return this.parentsService.createParentProfile(req.user.id, parentProfileDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get all parents with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of parents',
    type: PaginatedParentsResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'county', required: false })
  @ApiQuery({ name: 'subCounty', required: false })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search?: string,
    @Query('county') county?: string,
    @Query('subCounty') subCounty?: string,
  ): Promise<PaginatedParentsResponseDto> {
    return this.parentsService.findAll(page, limit, search, county, subCounty);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get parent statistics' })
  @ApiResponse({ status: 200, description: 'Parent statistics' })
  async getStats() {
    return this.parentsService.getParentStats();
  }

  @Get('my-profile')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Get current parent profile' })
  @ApiResponse({
    status: 200,
    description: 'Parent profile',
    type: ParentResponseDto,
  })
  async getMyProfile(@Request() req: any): Promise<ParentResponseDto> {
    return this.parentsService.findByUserId(req.user.id);
  }

  @Get('search/:term')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search parents' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiParam({ name: 'term', description: 'Search term' })
  async search(@Param('term') term: string) {
    return this.parentsService.searchParents(term);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get a parent by ID' })
  @ApiResponse({
    status: 200,
    description: 'Parent details',
    type: ParentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  @ApiParam({ name: 'id', description: 'Parent ID' })
  async findOne(@Param('id') id: string): Promise<ParentResponseDto> {
    return this.parentsService.findOne(id);
  }

  @Get('user/:userId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get parent by user ID' })
  @ApiResponse({
    status: 200,
    description: 'Parent details',
    type: ParentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  async findByUserId(@Param('userId') userId: string): Promise<ParentResponseDto> {
    return this.parentsService.findByUserId(userId);
  }

  @Patch('profile')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Update parent profile' })
  @ApiResponse({
    status: 200,
    description: 'Parent profile updated successfully',
    type: ParentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent profile not found' })
  async updateProfile(
    @Body() parentProfileDto: ParentProfileDto,
    @Request() req: any,
  ): Promise<ParentResponseDto> {
    return this.parentsService.updateParentProfile(req.user.id, parentProfileDto);
  }

  @Post(':id/link-child')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Link child to parent' })
  @ApiResponse({
    status: 200,
    description: 'Child linked successfully',
    type: ParentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent or child not found' })
  @ApiResponse({ status: 409, description: 'Child already linked to another parent' })
  async linkChild(
    @Param('id') id: string,
    @Body() linkChildDto: LinkChildDto,
  ): Promise<ParentResponseDto> {
    return this.parentsService.linkChildToParent(id, linkChildDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a parent' })
  @ApiResponse({ status: 204, description: 'Parent deleted successfully' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete parent with children' })
  async remove(@Param('id') id: string): Promise<void> {
    return this.parentsService.remove(id);
  }
}