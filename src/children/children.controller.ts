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
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { UpdateChildDto } from './dto/update-child.dto';
import { ChildResponseDto, PaginatedChildrenResponseDto } from './dto/child-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('children')
@Controller('children')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Post()
  @Roles(UserRole.PARENT, UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Register a new child' })
  @ApiResponse({
    status: 201,
    description: 'Child registered successfully',
    type: ChildResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  @ApiResponse({ status: 409, description: 'Birth certificate already exists' })
  async create(
    @Body() createChildDto: CreateChildDto,
    @Request() req: any,
  ): Promise<ChildResponseDto> {
    // If parent is registering their own child, ensure parentId matches their ID
    if (req.user.role === UserRole.PARENT) {
      const parent = await this.getParentIdFromUser(req.user.id);
      createChildDto.parentId = parent;
    }
    
    return this.childrenService.create(createChildDto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all children with pagination' })
  @ApiResponse({
    status: 200,
    description: 'List of children',
    type: PaginatedChildrenResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiQuery({ name: 'search', required: false })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('parentId') parentId?: string,
    @Query('search') search?: string,
    @Request() req?: any,
  ): Promise<PaginatedChildrenResponseDto> {
    // If user is a parent, only show their children
    if (req?.user?.role === UserRole.PARENT) {
      const parent = await this.getParentIdFromUser(req.user.id);
      parentId = parent;
    }
    
    return this.childrenService.findAll(page, limit, parentId, search);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.HEALTH_WORKER)
  @ApiOperation({ summary: 'Get children statistics' })
  @ApiResponse({ status: 200, description: 'Children statistics' })
  async getStats() {
    return this.childrenService.getStats();
  }

  @Get('my-children')
  @Roles(UserRole.PARENT)
  @ApiOperation({ summary: 'Get current parent\'s children' })
  @ApiResponse({
    status: 200,
    description: 'List of parent\'s children',
    type: [ChildResponseDto],
  })
  async getMyChildren(@Request() req: any): Promise<ChildResponseDto[]> {
    const parentId = await this.getParentIdFromUser(req.user.id);
    return this.childrenService.findByParentId(parentId);
  }

  @Get('search/:term')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Search children by name or certificate number' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiParam({ name: 'term', description: 'Search term' })
  async search(@Param('term') term: string) {
    return this.childrenService.searchChildren(term);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a child by ID' })
  @ApiResponse({
    status: 200,
    description: 'Child details',
    type: ChildResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Child not found' })
  @ApiParam({ name: 'id', description: 'Child ID' })
  async findOne(@Param('id') id: string): Promise<ChildResponseDto> {
    return this.childrenService.findOne(id);
  }

  @Get('certificate/:birthCertificateNo')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get child by birth certificate number' })
  @ApiResponse({
    status: 200,
    description: 'Child details',
    type: ChildResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Child not found' })
  async findByBirthCertificate(
    @Param('birthCertificateNo') birthCertificateNo: string,
  ) {
    return this.childrenService.searchChildren(birthCertificateNo);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a child' })
  @ApiResponse({
    status: 200,
    description: 'Child updated successfully',
    type: ChildResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Child not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id') id: string,
    @Body() updateChildDto: UpdateChildDto,
    @Request() req: any,
  ): Promise<ChildResponseDto> {
    return this.childrenService.update(id, updateChildDto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.PARENT, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a child' })
  @ApiResponse({ status: 204, description: 'Child deleted successfully' })
  @ApiResponse({ status: 404, description: 'Child not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 400, description: 'Cannot delete child with records' })
  async remove(@Param('id') id: string, @Request() req: any): Promise<void> {
    return this.childrenService.remove(id, req.user.id);
  }

  @Get(':id/validate')
  @Roles(UserRole.HEALTH_WORKER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Validate child for vaccination' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateChild(@Param('id') id: string) {
    return this.childrenService.validateChildForVaccination(id);
  }

  private async getParentIdFromUser(userId: string): Promise<string> {
    const parent = await this.childrenService['prisma'].parent.findUnique({
      where: { userId },
      select: { id: true },
    });
    
    if (!parent) {
      throw new Error('Parent profile not found for user');
    }
    
    return parent.id;
  }
}